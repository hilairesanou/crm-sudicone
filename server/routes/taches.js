// server/routes/taches.js
const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/taches
router.get('/', (req, res) => {
  const { statut, assigned_to } = req.query;
  let sql = `
    SELECT t.*, c.nom as contact_nom, u.nom as assigned_nom
    FROM taches t
    LEFT JOIN contacts c ON c.id = t.contact_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE 1=1
  `;
  const params = [];
  if (statut) { sql += ' AND t.statut = ?'; params.push(statut); }
  if (assigned_to) { sql += ' AND t.assigned_to = ?'; params.push(assigned_to); }
  sql += ' ORDER BY t.date_echeance ASC';

  res.json(db.prepare(sql).all(...params));
});

// POST /api/taches
router.post('/', (req, res) => {
  const { titre, description, contact_id, opportunite_id, priorite, date_echeance, assigned_to } = req.body;
  if (!titre) return res.status(400).json({ error: 'Le titre est requis' });

  const result = db.prepare(`
    INSERT INTO taches (titre, description, contact_id, opportunite_id, priorite, date_echeance, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    titre, description || null, contact_id || null, opportunite_id || null,
    priorite || 'normale', date_echeance || null, assigned_to || req.session.userId
  );

  res.status(201).json(db.prepare('SELECT * FROM taches WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/taches/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable' });

  const { titre, description, statut, priorite, date_echeance, assigned_to } = req.body;

  db.prepare(`
    UPDATE taches SET titre = ?, description = ?, statut = ?, priorite = ?, date_echeance = ?, assigned_to = ?
    WHERE id = ?
  `).run(
    titre ?? existing.titre, description ?? existing.description, statut ?? existing.statut,
    priorite ?? existing.priorite, date_echeance ?? existing.date_echeance,
    assigned_to ?? existing.assigned_to, req.params.id
  );

  res.json(db.prepare('SELECT * FROM taches WHERE id = ?').get(req.params.id));
});

// DELETE /api/taches/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM taches WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
