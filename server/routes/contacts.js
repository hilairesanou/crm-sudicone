// server/routes/contacts.js
const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

// GET /api/contacts - liste avec recherche/filtre optionnel
router.get('/', (req, res) => {
  const { q, type } = req.query;
  let sql = `
    SELECT c.*, u.nom as owner_nom
    FROM contacts c
    LEFT JOIN users u ON u.id = c.owner_id
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    sql += ` AND (c.nom LIKE ? OR c.entreprise LIKE ? OR c.email LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (type) {
    sql += ` AND c.type = ?`;
    params.push(type);
  }
  sql += ` ORDER BY c.created_at DESC`;

  const contacts = db.prepare(sql).all(...params);
  res.json(contacts);
});

// GET /api/contacts/:id - détail + opportunités + tâches liées
router.get('/:id', (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

  contact.opportunites = db.prepare('SELECT * FROM opportunites WHERE contact_id = ? ORDER BY created_at DESC').all(req.params.id);
  contact.taches = db.prepare('SELECT * FROM taches WHERE contact_id = ? ORDER BY date_echeance ASC').all(req.params.id);
  contact.factures = db.prepare('SELECT * FROM factures WHERE contact_id = ? ORDER BY created_at DESC').all(req.params.id);
  contact.activites = db.prepare('SELECT * FROM activites WHERE contact_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
  contact.services = db.prepare(
    `SELECT cs.*, s.titre as service_titre, s.categorie as service_categorie, s.prix_ht as service_prix_ht
     FROM contact_services cs
     LEFT JOIN services s ON s.id = cs.service_id
     WHERE cs.contact_id = ?`
  ).all(req.params.id);
  contact.packs = db.prepare(
    `SELECT cp.*, p.nom as pack_nom, p.prix_ht as pack_prix_ht
     FROM contact_packs cp
     LEFT JOIN service_packs p ON p.id = cp.pack_id
     WHERE cp.contact_id = ?`
  ).all(req.params.id);

  res.json(contact);
});

// POST /api/contacts
router.post('/', (req, res) => {
  const {
    type, nom, entreprise, email, telephone, adresse, ville, pays,
    siret, secteur, site_web, code_client, responsable, statut_client,
    date_entree, date_renouvellement, mode_paiement, note_technique, note_comptable, notes
  } = req.body;
  if (!nom) return res.status(400).json({ error: 'Le nom est requis' });

  const result = db.prepare(`
    INSERT INTO contacts (type, nom, entreprise, email, telephone, adresse, ville, pays,
      siret, secteur, site_web, code_client, responsable, statut_client, date_entree,
      date_renouvellement, mode_paiement, note_technique, note_comptable, notes, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    type || 'prospect', nom, entreprise || null, email || null, telephone || null, adresse || null,
    ville || null, pays || 'Burkina Faso', siret || null, secteur || null, site_web || null,
    code_client || null, responsable || null, statut_client || 'actif', date_entree || null,
    date_renouvellement || null, mode_paiement || null, note_technique || null,
    note_comptable || null, notes || null, req.session.userId);

  logActivite('contact_cree', `Contact "${nom}" créé`, result.lastInsertRowid, req.session.userId);

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(contact);
});

// PUT /api/contacts/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact introuvable' });

  const {
    type, nom, entreprise, email, telephone, adresse, ville, pays,
    siret, secteur, site_web, code_client, responsable, statut_client,
    date_entree, date_renouvellement, mode_paiement, note_technique, note_comptable, notes
  } = req.body;

  db.prepare(`
    UPDATE contacts SET
      type = ?, nom = ?, entreprise = ?, email = ?, telephone = ?,
      adresse = ?, ville = ?, pays = ?, siret = ?, secteur = ?, site_web = ?,
      code_client = ?, responsable = ?, statut_client = ?, date_entree = ?,
      date_renouvellement = ?, mode_paiement = ?, note_technique = ?,
      note_comptable = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    type || existing.type, nom || existing.nom, entreprise ?? existing.entreprise,
    email ?? existing.email, telephone ?? existing.telephone, adresse ?? existing.adresse,
    ville ?? existing.ville, pays ?? existing.pays, siret ?? existing.siret,
    secteur ?? existing.secteur, site_web ?? existing.site_web, code_client ?? existing.code_client,
    responsable ?? existing.responsable, statut_client ?? existing.statut_client,
    date_entree ?? existing.date_entree, date_renouvellement ?? existing.date_renouvellement,
    mode_paiement ?? existing.mode_paiement, note_technique ?? existing.note_technique,
    note_comptable ?? existing.note_comptable, notes ?? existing.notes, req.params.id
  );

  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/contacts/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact introuvable' });

  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
