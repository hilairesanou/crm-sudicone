const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

router.get('/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE actif = 1 ORDER BY categorie, titre').all();
  res.json(services);
});

router.get('/packs', (req, res) => {
  const packs = db.prepare('SELECT * FROM service_packs WHERE actif = 1 ORDER BY nom').all();
  packs.forEach(pack => {
    pack.services = db.prepare(
      `SELECT s.* FROM services s JOIN pack_services ps ON ps.service_id = s.id WHERE ps.pack_id = ?`
    ).all(pack.id);
  });
  res.json(packs);
});

router.post('/leads', (req, res) => {
  const {
    type, nom, entreprise, email, telephone, adresse, ville, pays,
    siret, secteur, site_web, message, service_id, pack_id, date_debut,
    date_fin, tarif_ht, renouvellement_auto, mode_paiement
  } = req.body;

  if (!nom) return res.status(400).json({ error: 'Le nom est requis.' });
  if (!email && !telephone) return res.status(400).json({ error: 'Email ou téléphone requis.' });
  if (!service_id && !pack_id) return res.status(400).json({ error: 'Veuillez choisir un service ou un pack.' });

  const result = db.prepare(`
    INSERT INTO contacts (type, nom, entreprise, email, telephone, adresse, ville, pays,
      siret, secteur, site_web, code_client, responsable, statut_client, date_entree,
      date_renouvellement, mode_paiement, note_technique, note_comptable, notes, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    type || 'prospect', nom, entreprise || null, email || null, telephone || null,
    adresse || null, ville || null, pays || 'Burkina Faso', siret || null, secteur || null,
    site_web || null, null, null, 'prospect', date_debut || null,
    date_fin || null, mode_paiement || null, null, null, message || null, null
  );

  const contactId = result.lastInsertRowid;
  const created = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);

  if (service_id) {
    const service = db.prepare('SELECT * FROM services WHERE id = ? AND actif = 1').get(service_id);
    if (service) {
      db.prepare(
        'INSERT INTO contact_services (contact_id, service_id, date_debut, date_fin, tarif_ht, renouvellement_auto) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(contactId, service_id, date_debut || null, date_fin || null, tarif_ht ?? service.prix_ht || 0, renouvellement_auto ? 1 : 0);
    }
  }

  if (pack_id) {
    const pack = db.prepare('SELECT * FROM service_packs WHERE id = ? AND actif = 1').get(pack_id);
    if (pack) {
      db.prepare(
        'INSERT INTO contact_packs (contact_id, pack_id, date_debut, date_fin, tarif_ht) VALUES (?, ?, ?, ?, ?)'
      ).run(contactId, pack_id, date_debut || null, date_fin || null, tarif_ht ?? pack.prix_ht || 0);
    }
  }

  logActivite('lead_public', `Lead public créé: ${nom}`, contactId, null);
  res.status(201).json({ contact: created, message: 'Votre intérêt a été enregistré. Un conseiller vous contactera bientôt.' });
});

module.exports = router;
