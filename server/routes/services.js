const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

// Services catalogue
router.get('/', (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE actif = 1 ORDER BY categorie, titre').all();
  res.json(services);
});

router.post('/', (req, res) => {
  const { code, titre, categorie, description, prix_ht, duree_mois } = req.body;
  if (!code || !titre || !categorie) return res.status(400).json({ error: 'code, titre et categorie requis' });
  const existing = db.prepare('SELECT id FROM services WHERE code = ?').get(code);
  if (existing) return res.status(409).json({ error: 'Un service avec ce code existe déjà' });
  const result = db.prepare(
    'INSERT INTO services (code, titre, categorie, description, prix_ht, duree_mois) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(code, titre, categorie, description || null, prix_ht || 0, duree_mois || 1);
  logActivite('service_cree', `Service ${titre} créé`, null, req.session.userId);
  res.status(201).json(db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Service introuvable' });
  const { titre, categorie, description, prix_ht, duree_mois, actif } = req.body;
  db.prepare(
    'UPDATE services SET titre = ?, categorie = ?, description = ?, prix_ht = ?, duree_mois = ?, actif = ? WHERE id = ?'
  ).run(
    titre ?? existing.titre,
    categorie ?? existing.categorie,
    description ?? existing.description,
    prix_ht ?? existing.prix_ht,
    duree_mois ?? existing.duree_mois,
    actif ?? existing.actif,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Service packs
router.get('/packs', (req, res) => {
  const packs = db.prepare('SELECT * FROM service_packs WHERE actif = 1 ORDER BY nom').all();
  packs.forEach(pack => {
    pack.services = db.prepare(
      `SELECT s.* FROM services s JOIN pack_services ps ON ps.service_id = s.id WHERE ps.pack_id = ?`
    ).all(pack.id);
  });
  res.json(packs);
});

router.post('/packs', (req, res) => {
  const { nom, description, prix_ht, duree_mois, service_ids } = req.body;
  if (!nom || !Array.isArray(service_ids)) return res.status(400).json({ error: 'Nom et service_ids requis' });
  const result = db.prepare(
    'INSERT INTO service_packs (nom, description, prix_ht, duree_mois) VALUES (?, ?, ?, ?)'
  ).run(nom, description || null, prix_ht || 0, duree_mois || 12);
  for (const serviceId of service_ids) {
    db.prepare('INSERT OR IGNORE INTO pack_services (pack_id, service_id) VALUES (?, ?)').run(result.lastInsertRowid, serviceId);
  }
  logActivite('pack_cree', `Pack ${nom} créé`, null, req.session.userId);
  res.status(201).json(db.prepare('SELECT * FROM service_packs WHERE id = ?').get(result.lastInsertRowid));
});

router.post('/assign-service', (req, res) => {
  const { contact_id, service_id, date_debut, date_fin, tarif_ht, renouvellement_auto } = req.body;
  if (!contact_id || !service_id) return res.status(400).json({ error: 'contact_id et service_id requis' });
  const result = db.prepare(
    'INSERT INTO contact_services (contact_id, service_id, date_debut, date_fin, tarif_ht, renouvellement_auto) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(contact_id, service_id, date_debut || null, date_fin || null, tarif_ht || 0, renouvellement_auto ? 1 : 0);
  logActivite('service_assign', `Service ${service_id} assigné au contact ${contact_id}`, contact_id, req.session.userId);
  res.status(201).json(db.prepare('SELECT * FROM contact_services WHERE id = ?').get(result.lastInsertRowid));
});

router.post('/assign-pack', (req, res) => {
  const { contact_id, pack_id, date_debut, date_fin, tarif_ht } = req.body;
  if (!contact_id || !pack_id) return res.status(400).json({ error: 'contact_id et pack_id requis' });
  const result = db.prepare(
    'INSERT INTO contact_packs (contact_id, pack_id, date_debut, date_fin, tarif_ht) VALUES (?, ?, ?, ?, ?)'
  ).run(contact_id, pack_id, date_debut || null, date_fin || null, tarif_ht || 0);
  logActivite('pack_assign', `Pack ${pack_id} assigné au contact ${contact_id}`, contact_id, req.session.userId);
  res.status(201).json(db.prepare('SELECT * FROM contact_packs WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/assignments', (req, res) => {
  const { contact_id } = req.query;
  if (!contact_id) return res.status(400).json({ error: 'contact_id requis' });
  const services = db.prepare(
    `SELECT cs.*, s.titre as service_titre, s.code as service_code, s.categorie, s.prix_ht as service_prix_ht
     FROM contact_services cs
     LEFT JOIN services s ON s.id = cs.service_id
     WHERE cs.contact_id = ?`
  ).all(contact_id);
  const packs = db.prepare(
    `SELECT cp.*, p.nom as pack_nom, p.prix_ht as pack_prix_ht
     FROM contact_packs cp
     LEFT JOIN service_packs p ON p.id = cp.pack_id
     WHERE cp.contact_id = ?`
  ).all(contact_id);
  res.json({ services, packs });
});

module.exports = router;
