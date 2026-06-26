// server/routes/opportunites.js
const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');
const { regle_opportuniteGagnee } = require('../utils/automations');

const router = express.Router();

// GET /api/opportunites
router.get('/', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  let sql = `
    SELECT o.*, c.nom as contact_nom, c.entreprise as contact_entreprise, u.nom as owner_nom
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    LEFT JOIN users u ON u.id = o.owner_id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'commercial') {
    sql += ` AND o.owner_id = ?`;
    params.push(userId);
  }
  sql += ` ORDER BY o.created_at DESC`;

  res.json(db.prepare(sql).all(...params));
});

// GET /api/opportunites/:id
router.get('/:id', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  const opp = db.prepare(`
    SELECT o.*, c.nom as contact_nom
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!opp) return res.status(404).json({ error: 'Opportunité introuvable' });

  if (role === 'commercial' && opp.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  res.json(opp);
});

// POST /api/opportunites
router.post('/', (req, res) => {
  const {
    titre, contact_id, montant, etape,
    probabilite, date_cloture_prevue, notes
  } = req.body;

  if (!titre) return res.status(400).json({ error: 'Le titre est requis' });

  const result = db.prepare(`
    INSERT INTO opportunites (titre, contact_id, montant, devise, etape,
      probabilite, date_cloture_prevue, notes, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    titre, contact_id || null, montant || 0,
    'XOF', // ← forcé XOF
    etape || 'nouveau', probabilite || 10,
    date_cloture_prevue || null, notes || null,
    req.session.userId
  );

  logActivite(
    'opportunite_creee',
    `Opportunité "${titre}" créée — ${(montant || 0).toLocaleString('fr-FR')} XOF`,
    contact_id, req.session.userId
  );

  const opp = db.prepare('SELECT * FROM opportunites WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(opp);
});

// PUT /api/opportunites/:id
router.put('/:id', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  const existing = db.prepare('SELECT * FROM opportunites WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Opportunité introuvable' });

  if (role === 'commercial' && existing.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  const {
    titre, contact_id, montant, etape,
    probabilite, date_cloture_prevue, notes
  } = req.body;

  db.prepare(`
    UPDATE opportunites SET
      titre = ?, contact_id = ?, montant = ?, devise = 'XOF', etape = ?,
      probabilite = ?, date_cloture_prevue = ?, notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    titre ?? existing.titre,
    contact_id ?? existing.contact_id,
    montant ?? existing.montant,
    etape ?? existing.etape,
    probabilite ?? existing.probabilite,
    date_cloture_prevue ?? existing.date_cloture_prevue,
    notes ?? existing.notes,
    req.params.id
  );

  // Automatisation si étape changée
  if (etape && etape !== existing.etape) {
    regle_opportuniteGagnee(parseInt(req.params.id));
  }

  // Logs selon ce qui a changé
  if (etape && etape !== existing.etape) {
    const etapeLabel = {
      nouveau: 'Nouveau', qualification: 'Qualification',
      proposition: 'Proposition', negociation: 'Négociation',
      gagne: 'Gagné', perdu: 'Perdu'
    };
    logActivite(
      'opportunite_etape',
      `Opportunité "${existing.titre}" → étape "${etapeLabel[etape] || etape}"`,
      existing.contact_id, userId
    );
  }

  if (montant && montant !== existing.montant) {
    logActivite(
      'opportunite_montant',
      `Montant mis à jour : ${existing.montant?.toLocaleString('fr-FR')} → ${Number(montant).toLocaleString('fr-FR')} XOF`,
      existing.contact_id, userId
    );
  }

  const updated = db.prepare('SELECT * FROM opportunites WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/opportunites/:id
router.delete('/:id', (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Suppression réservée à l\'administrateur.' });
  }

  const existing = db.prepare('SELECT * FROM opportunites WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Opportunité introuvable' });

  logActivite(
    'opportunite_supprimee',
    `Opportunité "${existing.titre}" supprimée`,
    existing.contact_id, req.session.userId
  );

  db.prepare('DELETE FROM opportunites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;