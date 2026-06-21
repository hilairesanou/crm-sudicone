// server/routes/stats.js
const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/stats/dashboard - vue d'ensemble (cartes chiffrées)
router.get('/dashboard', (req, res) => {
  const totalContacts = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  const totalClients = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE type = 'client'`).get().c;
  const totalOpportunites = db.prepare('SELECT COUNT(*) as c FROM opportunites').get().c;
  const totalFactures = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE type = 'facture'`).get().c;
  const totalDevis = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE type = 'devis'`).get().c;
  const totalDocuments = db.prepare('SELECT COUNT(*) as c FROM factures').get().c;
  const totalWorkflows = db.prepare('SELECT COUNT(*) as c FROM workflows').get().c;
  const totalTaches = db.prepare('SELECT COUNT(*) as c FROM taches').get().c;
  const oppEnCours = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(montant),0) as total FROM opportunites WHERE etape NOT IN ('gagne', 'perdu')`).get();
  const oppGagnees = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(montant),0) as total FROM opportunites WHERE etape = 'gagne'`).get();
  const facturesEnRetard = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE statut = 'en_retard'`).get().c;
  const caTotal = db.prepare(`SELECT COALESCE(SUM(montant_ttc),0) as total FROM factures WHERE statut = 'paye'`).get().total;
  const tachesEnCours = db.prepare(`SELECT COUNT(*) as c FROM taches WHERE statut IN ('a_faire', 'en_cours')`).get().c;
  const notesTechnique = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE note_technique IS NOT NULL AND note_technique != ''`).get().c;
  const notesComptables = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE note_comptable IS NOT NULL AND note_comptable != ''`).get().c;

  res.json({
    totalContacts,
    totalClients,
    totalOpportunites,
    totalFactures,
    totalDevis,
    totalDocuments,
    totalWorkflows,
    totalTaches,
    oppEnCours: oppEnCours.c,
    oppEnCoursMontant: oppEnCours.total,
    oppGagnees: oppGagnees.c,
    oppGagneesMontant: oppGagnees.total,
    facturesEnRetard,
    caTotal,
    tachesEnCours,
    notesTechnique,
    notesComptables
  });
});

// GET /api/stats/pipeline-par-etape - pour le camembert du pipeline
router.get('/pipeline-par-etape', (req, res) => {
  const data = db.prepare(`
    SELECT etape, COUNT(*) as count, COALESCE(SUM(montant),0) as montant
    FROM opportunites
    GROUP BY etape
  `).all();
  res.json(data);
});

// GET /api/stats/contacts-par-type - camembert répartition contacts
router.get('/contacts-par-type', (req, res) => {
  const data = db.prepare(`
    SELECT type, COUNT(*) as count FROM contacts GROUP BY type
  `).all();
  res.json(data);
});

// GET /api/stats/ca-mensuel - courbe d'évolution du CA sur 12 mois
router.get('/ca-mensuel', (req, res) => {
  const data = db.prepare(`
    SELECT strftime('%Y-%m', date_emission) as mois, COALESCE(SUM(montant_ttc),0) as total
    FROM factures
    WHERE statut = 'paye' AND date_emission >= date('now', '-12 months')
    GROUP BY mois
    ORDER BY mois ASC
  `).all();
  res.json(data);
});

// GET /api/stats/opportunites-mensuel - courbe nombre d'opportunités créées par mois
router.get('/opportunites-mensuel', (req, res) => {
  const data = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as mois, COUNT(*) as count
    FROM opportunites
    WHERE created_at >= date('now', '-12 months')
    GROUP BY mois
    ORDER BY mois ASC
  `).all();
  res.json(data);
});

// GET /api/stats/taches-par-statut - camembert tâches
router.get('/taches-par-statut', (req, res) => {
  const data = db.prepare(`
    SELECT statut, COUNT(*) as count FROM taches GROUP BY statut
  `).all();
  res.json(data);
});

// GET /api/stats/services-par-categorie - répartition des services vendus par catégorie
router.get('/services-par-categorie', (req, res) => {
  const data = db.prepare(`
    SELECT s.categorie, COUNT(*) as count, COALESCE(SUM(cs.tarif_ht),0) as montant
    FROM contact_services cs
    LEFT JOIN services s ON s.id = cs.service_id
    GROUP BY s.categorie
  `).all();
  res.json(data);
});

router.get('/factures-par-statut', (req, res) => {
  const data = db.prepare(`
    SELECT statut, COUNT(*) as count, COALESCE(SUM(montant_ttc),0) as montant
    FROM factures
    GROUP BY statut
  `).all();
  res.json(data);
});

router.get('/devis-par-statut', (req, res) => {
  const data = db.prepare(`
    SELECT statut, COUNT(*) as count, COALESCE(SUM(montant_ttc),0) as montant
    FROM factures
    WHERE type = 'devis'
    GROUP BY statut
  `).all();
  res.json(data);
});

router.get('/taches-par-priorite', (req, res) => {
  const data = db.prepare(`
    SELECT priorite, COUNT(*) as count FROM taches GROUP BY priorite
  `).all();
  res.json(data);
});

// GET /api/stats/workflows-par-statut - comptage workflows
router.get('/workflows-par-statut', (req, res) => {
  const data = db.prepare(`
    SELECT statut, COUNT(*) as count FROM workflows GROUP BY statut
  `).all();
  res.json(data);
});

// GET /api/stats/performance-commerciaux - classement par utilisateur (utile pour manager/admin)
router.get('/performance-commerciaux', (req, res) => {
  const data = db.prepare(`
    SELECT u.nom, COUNT(o.id) as nb_opportunites, COALESCE(SUM(CASE WHEN o.etape = 'gagne' THEN o.montant ELSE 0 END),0) as ca_gagne
    FROM users u
    LEFT JOIN opportunites o ON o.owner_id = u.id
    GROUP BY u.id
    ORDER BY ca_gagne DESC
  `).all();
  res.json(data);
});

module.exports = router;
