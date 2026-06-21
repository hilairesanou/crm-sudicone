// server/routes/opportunites.js
const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

// GET /api/opportunites - liste, groupable par étape côté front pour le Kanban
router.get('/', (req, res) => {
  const opportunites = db.prepare(`
    SELECT o.*, c.nom as contact_nom, c.entreprise as contact_entreprise, u.nom as owner_nom
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    LEFT JOIN users u ON u.id = o.owner_id
    ORDER BY o.created_at DESC
  `).all();
  res.json(opportunites);
});

// GET /api/opportunites/:id
router.get('/:id', (req, res) => {
  const opp = db.prepare(`
    SELECT o.*, c.nom as contact_nom
    FROM opportunites o LEFT JOIN contacts c ON c.id = o.contact_id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!opp) return res.status(404).json({ error: 'Opportunité introuvable' });
  res.json(opp);
});

// POST /api/opportunites
router.post('/', (req, res) => {
  const { titre, contact_id, montant, devise, etape, probabilite, date_cloture_prevue, notes } = req.body;
  if (!titre) return res.status(400).json({ error: 'Le titre est requis' });

  const result = db.prepare(`
    INSERT INTO opportunites (titre, contact_id, montant, devise, etape, probabilite, date_cloture_prevue, notes, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    titre, contact_id || null, montant || 0, devise || 'XOF',
    etape || 'nouveau', probabilite || 10, date_cloture_prevue || null,
    notes || null, req.session.userId
  );

  logActivite('opportunite_creee', `Opportunité "${titre}" créée`, contact_id, req.session.userId);

  const opp = db.prepare('SELECT * FROM opportunites WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(opp);
});

// PUT /api/opportunites/:id - mise à jour générale (et déplacement d'étape pour le Kanban)
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunites WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Opportunité introuvable' });

  const { titre, contact_id, montant, devise, etape, probabilite, date_cloture_prevue, notes } = req.body;

  db.prepare(`
    UPDATE opportunites SET
      titre = ?, contact_id = ?, montant = ?, devise = ?, etape = ?,
      probabilite = ?, date_cloture_prevue = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    titre ?? existing.titre, contact_id ?? existing.contact_id, montant ?? existing.montant,
    devise ?? existing.devise, etape ?? existing.etape, probabilite ?? existing.probabilite,
    date_cloture_prevue ?? existing.date_cloture_prevue, notes ?? existing.notes, req.params.id
  );

  if (etape && etape !== existing.etape) {
    logActivite('opportunite_etape', `Opportunité "${existing.titre}" déplacée vers "${etape}"`, existing.contact_id, req.session.userId);
  }

  const updated = db.prepare('SELECT * FROM opportunites WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/opportunites/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunites WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Opportunité introuvable' });

  db.prepare('DELETE FROM opportunites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
