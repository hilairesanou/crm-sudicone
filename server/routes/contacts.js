// server/routes/contacts.js
const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

// GET /api/contacts
router.get('/', (req, res) => {
  const { q, type } = req.query;
  const role   = req.session.role;
  const userId = req.session.userId;

  let sql = `
    SELECT c.*, u.nom as owner_nom
    FROM contacts c
    LEFT JOIN users u ON u.id = c.owner_id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'commercial') {
    sql += ` AND c.owner_id = ?`;
    params.push(userId);
  }
  if (q) {
    sql += ` AND (c.nom LIKE ? OR c.entreprise LIKE ? OR c.email LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (type) {
    sql += ` AND c.type = ?`;
    params.push(type);
  }
  sql += ` ORDER BY c.created_at DESC`;

  res.json(db.prepare(sql).all(...params));
});

// GET /api/contacts/:id
router.get('/:id', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' });

  if (role === 'commercial' && contact.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  contact.opportunites = db.prepare(
    'SELECT * FROM opportunites WHERE contact_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  contact.taches = db.prepare(
    'SELECT * FROM taches WHERE contact_id = ? ORDER BY date_echeance ASC'
  ).all(req.params.id);

  contact.factures = db.prepare(
    'SELECT * FROM factures WHERE contact_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  contact.activites = db.prepare(
    'SELECT * FROM activites WHERE contact_id = ? ORDER BY created_at DESC LIMIT 30'
  ).all(req.params.id);

  contact.services = db.prepare(`
    SELECT cs.*, s.titre as service_titre, s.categorie as service_categorie,
           s.prix_ht as service_prix_ht
    FROM contact_services cs
    LEFT JOIN services s ON s.id = cs.service_id
    WHERE cs.contact_id = ?
  `).all(req.params.id);

  contact.packs = db.prepare(`
    SELECT cp.*, p.nom as pack_nom, p.prix_ht as pack_prix_ht
    FROM contact_packs cp
    LEFT JOIN service_packs p ON p.id = cp.pack_id
    WHERE cp.contact_id = ?
  `).all(req.params.id);

  res.json(contact);
});

// POST /api/contacts
router.post('/', (req, res) => {
  const {
    type, nom, entreprise, email, telephone, adresse, ville, pays,
    siret, secteur, site_web, code_client, responsable, statut_client,
    date_entree, date_renouvellement, mode_paiement, note_technique,
    note_comptable, notes
  } = req.body;

  if (!nom) return res.status(400).json({ error: 'Le nom est requis' });

  const result = db.prepare(`
    INSERT INTO contacts (type, nom, entreprise, email, telephone, adresse, ville, pays,
      siret, secteur, site_web, code_client, responsable, statut_client, date_entree,
      date_renouvellement, mode_paiement, note_technique, note_comptable, notes, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    type || 'prospect', nom, entreprise || null, email || null, telephone || null,
    adresse || null, ville || null, pays || 'Burkina Faso', siret || null,
    secteur || null, site_web || null, code_client || null, responsable || null,
    statut_client || 'actif', date_entree || null, date_renouvellement || null,
    mode_paiement || null, note_technique || null, note_comptable || null,
    notes || null, req.session.userId
  );

  const contactId = result.lastInsertRowid;

  logActivite(
    'contact_cree',
    `Contact "${nom}" créé${entreprise ? ' — ' + entreprise : ''}`,
    contactId, req.session.userId
  );

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  res.status(201).json(contact);
});

// PUT /api/contacts/:id
router.put('/:id', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact introuvable' });

  if (role === 'commercial' && existing.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  const {
    type, nom, entreprise, email, telephone, adresse, ville, pays,
    siret, secteur, site_web, code_client, responsable, statut_client,
    date_entree, date_renouvellement, mode_paiement, note_technique,
    note_comptable, notes
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
    secteur ?? existing.secteur, site_web ?? existing.site_web,
    code_client ?? existing.code_client, responsable ?? existing.responsable,
    statut_client ?? existing.statut_client, date_entree ?? existing.date_entree,
    date_renouvellement ?? existing.date_renouvellement,
    mode_paiement ?? existing.mode_paiement, note_technique ?? existing.note_technique,
    note_comptable ?? existing.note_comptable, notes ?? existing.notes, req.params.id
  );

  const { regle_nouveauClient } = require('../utils/automations');

// Après le UPDATE...
if (type && type !== existing.type) {
  regle_nouveauClient(parseInt(req.params.id), existing.type, type);
}

  // ── Logs selon ce qui a changé ────────────────────────────────────
  const changements = [];

  if (type && type !== existing.type) {
    const typeLabel = { prospect: 'Prospect', client: 'Client', partenaire: 'Partenaire' };
    changements.push(`type → ${typeLabel[type] || type}`);
  }
  if (statut_client && statut_client !== existing.statut_client) {
    const statutLabel = {
      actif: 'Actif', prospect: 'Prospect',
      partenaire: 'Partenaire', ancien: 'Ancien', suspendu: 'Suspendu'
    };
    changements.push(`statut → ${statutLabel[statut_client] || statut_client}`);
  }
  if (telephone && telephone !== existing.telephone) {
    changements.push(`téléphone mis à jour`);
  }
  if (email && email !== existing.email) {
    changements.push(`email mis à jour`);
  }
  if (notes && notes !== existing.notes) {
    changements.push(`notes mises à jour`);
  }

  if (changements.length > 0) {
    logActivite(
      'contact_modifie',
      `Contact "${existing.nom}" modifié — ${changements.join(', ')}`,
      parseInt(req.params.id), userId
    );
  }

  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/contacts/:id
router.delete('/:id', (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Suppression réservée à l\'administrateur.' });
  }

  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact introuvable' });

  logActivite(
    'contact_supprime',
    `Contact "${existing.nom}" supprimé`,
    null, req.session.userId
  );

  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;