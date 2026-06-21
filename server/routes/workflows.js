const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

router.get('/', (req, res) => {
  const workflows = db.prepare(`
    SELECT w.*, c.nom as contact_nom, u.nom as owner_nom
    FROM workflows w
    LEFT JOIN contacts c ON c.id = w.contact_id
    LEFT JOIN users u ON u.id = w.owner_id
    ORDER BY w.created_at DESC
  `).all();
  workflows.forEach(w => {
    w.steps = db.prepare('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY ordre ASC').all(w.id);
  });
  res.json(workflows);
});

router.post('/', (req, res) => {
  const { titre, description, contact_id, date_debut, date_fin_prevue, steps } = req.body;
  if (!titre) return res.status(400).json({ error: 'Titre requis' });
  const result = db.prepare(`
    INSERT INTO workflows (titre, description, contact_id, owner_id, date_debut, date_fin_prevue)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(titre, description || null, contact_id || null, req.session.userId, date_debut || null, date_fin_prevue || null);
  const workflowId = result.lastInsertRowid;
  if (Array.isArray(steps)) {
    const insertStep = db.prepare(`
      INSERT INTO workflow_steps (workflow_id, titre, description, ordre, assigned_to, date_debut, date_fin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    steps.forEach((step, index) => {
      insertStep.run(workflowId, step.titre, step.description || null, index + 1, step.assigned_to || null, step.date_debut || null, step.date_fin || null);
    });
  }
  logActivite('workflow_cree', `Workflow ${titre} créé`, contact_id, req.session.userId);
  res.status(201).json(db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Workflow introuvable' });
  const { titre, description, contact_id, statut, date_debut, date_fin_prevue, date_terminee } = req.body;
  db.prepare(`
    UPDATE workflows SET titre = ?, description = ?, contact_id = ?, statut = ?, date_debut = ?, date_fin_prevue = ?, date_terminee = ? WHERE id = ?
  `).run(
    titre ?? existing.titre,
    description ?? existing.description,
    contact_id ?? existing.contact_id,
    statut ?? existing.statut,
    date_debut ?? existing.date_debut,
    date_fin_prevue ?? existing.date_fin_prevue,
    date_terminee ?? existing.date_terminee,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id));
});

router.post('/:id/steps', (req, res) => {
  const { titre, description, ordre, assigned_to, date_debut, date_fin } = req.body;
  const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Workflow introuvable' });
  const result = db.prepare(`
    INSERT INTO workflow_steps (workflow_id, titre, description, ordre, assigned_to, date_debut, date_fin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, titre, description || null, ordre || 1, assigned_to || null, date_debut || null, date_fin || null);
  res.status(201).json(db.prepare('SELECT * FROM workflow_steps WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/steps/:stepId', (req, res) => {
  const existing = db.prepare('SELECT * FROM workflow_steps WHERE id = ?').get(req.params.stepId);
  if (!existing) return res.status(404).json({ error: 'Étape introuvable' });
  const { titre, description, statut, ordre, assigned_to, date_debut, date_fin } = req.body;
  db.prepare(`
    UPDATE workflow_steps SET titre = ?, description = ?, statut = ?, ordre = ?, assigned_to = ?, date_debut = ?, date_fin = ? WHERE id = ?
  `).run(
    titre ?? existing.titre,
    description ?? existing.description,
    statut ?? existing.statut,
    ordre ?? existing.ordre,
    assigned_to ?? existing.assigned_to,
    date_debut ?? existing.date_debut,
    date_fin ?? existing.date_fin,
    req.params.stepId
  );
  res.json(db.prepare('SELECT * FROM workflow_steps WHERE id = ?').get(req.params.stepId));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM workflows WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/steps/:stepId', (req, res) => {
  db.prepare('DELETE FROM workflow_steps WHERE id = ?').run(req.params.stepId);
  res.json({ ok: true });
});

module.exports = router;
