// server/routes/taches.js
const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

// GET /api/taches
router.get('/', (req, res) => {
  const { statut, assigned_to } = req.query;
  const role   = req.session.role;
  const userId = req.session.userId;

  let sql = `
    SELECT t.*, c.nom as contact_nom, u.nom as assigned_nom
    FROM taches t
    LEFT JOIN contacts c ON c.id = t.contact_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE 1=1
  `;
  const params = [];

  if (role === 'commercial') {
    sql += ` AND t.assigned_to = ?`;
    params.push(userId);
  }
  if (statut)      { sql += ' AND t.statut = ?';      params.push(statut); }
  if (assigned_to) { sql += ' AND t.assigned_to = ?'; params.push(assigned_to); }
  sql += ' ORDER BY t.date_echeance ASC';

  res.json(db.prepare(sql).all(...params));
});

// POST /api/taches
router.post('/', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  const {
    titre, description, contact_id, opportunite_id,
    priorite, date_echeance, assigned_to
  } = req.body;

  if (!titre) return res.status(400).json({ error: 'Le titre est requis' });

  const assigneId = (role === 'commercial') ? userId : (assigned_to || userId);

  const result = db.prepare(`
    INSERT INTO taches (titre, description, contact_id, opportunite_id,
      priorite, date_echeance, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    titre, description || null, contact_id || null, opportunite_id || null,
    priorite || 'normale', date_echeance || null, assigneId
  );

  // ── Log activité ──────────────────────────────────────────────────
  logActivite(
    'tache_creee',
    `Tâche créée : "${titre}" (priorité ${priorite || 'normale'})`,
    contact_id || null,
    userId
  );

  res.status(201).json(db.prepare('SELECT * FROM taches WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/taches/:id
router.put('/:id', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  const existing = db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable' });

  if (role === 'commercial' && existing.assigned_to !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  const { titre, description, statut, priorite, date_echeance, assigned_to } = req.body;

  const nouvelAssigne = (role === 'commercial')
    ? existing.assigned_to
    : (assigned_to ?? existing.assigned_to);

  db.prepare(`
    UPDATE taches SET
      titre = ?, description = ?, statut = ?, priorite = ?,
      date_echeance = ?, assigned_to = ?
    WHERE id = ?
  `).run(
    titre ?? existing.titre, description ?? existing.description,
    statut ?? existing.statut, priorite ?? existing.priorite,
    date_echeance ?? existing.date_echeance, nouvelAssigne, req.params.id
  );

  // ── Log activité si statut changé ────────────────────────────────
  if (statut && statut !== existing.statut) {
    const statutLabel = {
      a_faire: 'À faire', en_cours: 'En cours',
      terminee: 'Terminée', annulee: 'Annulée'
    };
    logActivite(
      'tache_statut',
      `Tâche "${existing.titre}" → ${statutLabel[statut] || statut}`,
      existing.contact_id,
      userId
    );
  }

  res.json(db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id));
});

// DELETE /api/taches/:id
router.delete('/:id', (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Suppression réservée à l\'administrateur.' });
  }

  const existing = db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable' });

  logActivite(
    'tache_supprimee',
    `Tâche supprimée : "${existing.titre}"`,
    existing.contact_id,
    req.session.userId
  );

  db.prepare('DELETE FROM taches WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;