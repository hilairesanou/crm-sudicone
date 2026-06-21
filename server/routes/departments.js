const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

router.get('/', (req, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY nom').all();
  res.json(departments);
});

router.post('/', (req, res) => {
  const { nom, parent_id, description, responsable, telephone } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom requis' });
  const result = db.prepare(
    'INSERT INTO departments (nom, parent_id, description, responsable, telephone) VALUES (?, ?, ?, ?, ?)'
  ).run(nom, parent_id || null, description || null, responsable || null, telephone || null);
  logActivite('department_cree', `Département ${nom} créé`, null, req.session.userId);
  res.status(201).json(db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Département introuvable' });
  const { nom, parent_id, description, responsable, telephone } = req.body;
  db.prepare(
    'UPDATE departments SET nom = ?, parent_id = ?, description = ?, responsable = ?, telephone = ? WHERE id = ?'
  ).run(
    nom ?? existing.nom,
    parent_id ?? existing.parent_id,
    description ?? existing.description,
    responsable ?? existing.responsable,
    telephone ?? existing.telephone,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
