// server/routes/stats.js
const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// ─── GET /api/stats/dashboard ────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const { periode } = req.query;
  const mois = parseInt(periode) || 12;

  const totalContacts    = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  const totalClients     = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE type = 'client'`).get().c;
  const totalOpportunites= db.prepare('SELECT COUNT(*) as c FROM opportunites').get().c;
  const totalFactures    = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE type = 'facture'`).get().c;
  const totalDevis       = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE type = 'devis'`).get().c;
  const totalDocuments   = db.prepare('SELECT COUNT(*) as c FROM factures').get().c;
  const totalWorkflows   = db.prepare('SELECT COUNT(*) as c FROM workflows').get().c;
  const totalTaches      = db.prepare('SELECT COUNT(*) as c FROM taches').get().c;
  const oppEnCours       = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(montant),0) as total FROM opportunites WHERE etape NOT IN ('gagne', 'perdu')`).get();
  const oppGagnees       = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(montant),0) as total FROM opportunites WHERE etape = 'gagne'`).get();
  const facturesEnRetard = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE statut = 'en_retard'`).get().c;
  const tachesEnCours    = db.prepare(`SELECT COUNT(*) as c FROM taches WHERE statut IN ('a_faire', 'en_cours')`).get().c;

  const caTotal = db.prepare(`
    SELECT COALESCE(SUM(montant_ttc),0) as total
    FROM factures
    WHERE statut = 'paye'
    AND date_emission >= date('now', '-${mois} months')
  `).get().total;

  res.json({
    totalContacts, totalClients, totalOpportunites,
    totalFactures, totalDevis, totalDocuments,
    totalWorkflows, totalTaches,
    oppEnCours: oppEnCours.c,
    oppEnCoursMontant: oppEnCours.total,
    oppGagnees: oppGagnees.c,
    oppGagneesMontant: oppGagnees.total,
    facturesEnRetard, caTotal, tachesEnCours
  });
});

// ─── GET /api/stats/pipeline-par-etape ───────────────────────────────────────
router.get('/pipeline-par-etape', (req, res) => {
  const { commercial_id } = req.query;
  const filtreCommercial = commercial_id
    ? `AND owner_id = ${parseInt(commercial_id)}` : '';

  const data = db.prepare(`
    SELECT etape, COUNT(*) as count, COALESCE(SUM(montant),0) as montant
    FROM opportunites
    WHERE 1=1 ${filtreCommercial}
    GROUP BY etape
  `).all();
  res.json(data);
});

// ─── GET /api/stats/contacts-par-type ────────────────────────────────────────
router.get('/contacts-par-type', (req, res) => {
  const data = db.prepare(`
    SELECT type, COUNT(*) as count FROM contacts GROUP BY type
  `).all();
  res.json(data);
});

// ─── GET /api/stats/ca-mensuel ────────────────────────────────────────────────
router.get('/ca-mensuel', (req, res) => {
  const { periode } = req.query;
  const mois = parseInt(periode) || 12;

  const data = db.prepare(`
    SELECT strftime('%Y-%m', date_emission) as mois,
           COALESCE(SUM(montant_ttc),0) as total
    FROM factures
    WHERE statut = 'paye'
    AND date_emission >= date('now', '-${mois} months')
    GROUP BY mois
    ORDER BY mois ASC
  `).all();
  res.json(data);
});

// ─── GET /api/stats/opportunites-mensuel ─────────────────────────────────────
router.get('/opportunites-mensuel', (req, res) => {
  const { periode, commercial_id } = req.query;
  const mois = parseInt(periode) || 12;
  const filtreCommercial = commercial_id
    ? `AND owner_id = ${parseInt(commercial_id)}` : '';

  const data = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as mois, COUNT(*) as count
    FROM opportunites
    WHERE created_at >= date('now', '-${mois} months')
    ${filtreCommercial}
    GROUP BY mois
    ORDER BY mois ASC
  `).all();
  res.json(data);
});

// ─── GET /api/stats/taches-par-statut ────────────────────────────────────────
router.get('/taches-par-statut', (req, res) => {
  const data = db.prepare(`
    SELECT statut, COUNT(*) as count FROM taches GROUP BY statut
  `).all();
  res.json(data);
});

// ─── GET /api/stats/services-par-categorie ───────────────────────────────────
router.get('/services-par-categorie', (req, res) => {
  const data = db.prepare(`
    SELECT s.categorie, COUNT(*) as count, COALESCE(SUM(cs.tarif_ht),0) as montant
    FROM contact_services cs
    LEFT JOIN services s ON s.id = cs.service_id
    GROUP BY s.categorie
  `).all();
  res.json(data);
});

// ─── GET /api/stats/factures-par-statut ──────────────────────────────────────
router.get('/factures-par-statut', (req, res) => {
  const data = db.prepare(`
    SELECT statut, COUNT(*) as count, COALESCE(SUM(montant_ttc),0) as montant
    FROM factures
    GROUP BY statut
  `).all();
  res.json(data);
});

// ─── GET /api/stats/devis-par-statut ─────────────────────────────────────────
router.get('/devis-par-statut', (req, res) => {
  const data = db.prepare(`
    SELECT statut, COUNT(*) as count, COALESCE(SUM(montant_ttc),0) as montant
    FROM factures
    WHERE type = 'devis'
    GROUP BY statut
  `).all();
  res.json(data);
});

// ─── GET /api/stats/taches-par-priorite ──────────────────────────────────────
router.get('/taches-par-priorite', (req, res) => {
  const data = db.prepare(`
    SELECT priorite, COUNT(*) as count FROM taches GROUP BY priorite
  `).all();
  res.json(data);
});

// ─── GET /api/stats/workflows-par-statut ─────────────────────────────────────
router.get('/workflows-par-statut', (req, res) => {
  const data = db.prepare(`
    SELECT statut, COUNT(*) as count FROM workflows GROUP BY statut
  `).all();
  res.json(data);
});

// ─── GET /api/stats/performance-commerciaux ──────────────────────────────────
router.get('/performance-commerciaux', (req, res) => {
  const data = db.prepare(`
    SELECT u.nom,
      COUNT(o.id) as nb_opportunites,
      COALESCE(SUM(CASE WHEN o.etape = 'gagne' THEN o.montant ELSE 0 END),0) as ca_gagne
    FROM users u
    LEFT JOIN opportunites o ON o.owner_id = u.id
    GROUP BY u.id
    ORDER BY ca_gagne DESC
  `).all();
  res.json(data);
});

// ─── GET /api/stats/entonnoir-conversion ─────────────────────────────────────
router.get('/entonnoir-conversion', (req, res) => {
  const { commercial_id } = req.query;
  const filtreCommercial = commercial_id
    ? `AND owner_id = ${parseInt(commercial_id)}` : '';

  const etapes = ['nouveau', 'qualification', 'proposition', 'negociation', 'gagne'];
  const data = etapes.map(etape => {
    const row = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(montant),0) as montant
      FROM opportunites
      WHERE etape = ? ${filtreCommercial}
    `).get(etape);
    return { etape, count: row.count, montant: row.montant };
  });
  res.json(data);
});

// ─── GET /api/stats/ca-par-commercial ────────────────────────────────────────
router.get('/ca-par-commercial', (req, res) => {
  const { periode } = req.query;
  const mois = parseInt(periode) || 12;

  const data = db.prepare(`
    SELECT u.nom,
      COUNT(o.id) as nb_opps,
      COALESCE(SUM(CASE WHEN o.etape = 'gagne' THEN o.montant ELSE 0 END), 0) as ca_gagne,
      COALESCE(SUM(CASE WHEN o.etape NOT IN ('gagne','perdu') THEN o.montant ELSE 0 END), 0) as ca_pipeline,
      COUNT(CASE WHEN o.etape = 'gagne' THEN 1 END) as nb_gagnes,
      COUNT(CASE WHEN o.etape = 'perdu' THEN 1 END) as nb_perdus
    FROM users u
    LEFT JOIN opportunites o ON o.owner_id = u.id
      AND o.created_at >= date('now', '-${mois} months')
    WHERE u.actif = 1
    GROUP BY u.id, u.nom
    ORDER BY ca_gagne DESC
  `).all();
  res.json(data);
});

// ─── GET /api/stats/heatmap-activite ─────────────────────────────────────────
router.get('/heatmap-activite', (req, res) => {
  const { periode } = req.query;
  const mois = parseInt(periode) || 12;

  const data = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as mois,
           COUNT(*) as count
    FROM activites
    WHERE created_at >= date('now', '-${mois} months')
    GROUP BY mois
    ORDER BY mois ASC
  `).all();
  res.json(data);
});

// ─── GET /api/stats/taux-conversion-mensuel ──────────────────────────────────
router.get('/taux-conversion-mensuel', (req, res) => {
  const { periode, commercial_id } = req.query;
  const mois = parseInt(periode) || 12;
  const filtreCommercial = commercial_id
    ? `AND owner_id = ${parseInt(commercial_id)}` : '';

  const data = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as mois,
      COUNT(*) as total,
      COUNT(CASE WHEN etape = 'gagne' THEN 1 END) as gagnes
    FROM opportunites
    WHERE created_at >= date('now', '-${mois} months')
    ${filtreCommercial}
    GROUP BY mois
    ORDER BY mois ASC
  `).all();

  res.json(data.map(d => ({
    mois: d.mois,
    taux: d.total > 0 ? Math.round((d.gagnes / d.total) * 100) : 0,
    total: d.total,
    gagnes: d.gagnes
  })));
});

// ─── GET /api/stats/top-services ─────────────────────────────────────────────
router.get('/top-services', (req, res) => {
  const data = db.prepare(`
    SELECT s.titre, s.categorie,
      COUNT(cs.id) as nb_ventes,
      COALESCE(SUM(cs.tarif_ht), 0) as revenus
    FROM services s
    LEFT JOIN contact_services cs ON cs.service_id = s.id
    GROUP BY s.id, s.titre, s.categorie
    ORDER BY revenus DESC
    LIMIT 8
  `).all();
  res.json(data);
});

// ─── GET /api/stats/delai-paiement ───────────────────────────────────────────
router.get('/delai-paiement', (req, res) => {
  const { periode } = req.query;
  const mois = parseInt(periode) || 12;

  const data = db.prepare(`
    SELECT
      AVG(CASE WHEN statut = 'paye'
          THEN julianday(date_emission) - julianday(date_echeance)
          END) as delai_moyen,
      COUNT(CASE WHEN statut = 'paye' THEN 1 END) as nb_payees,
      COUNT(CASE WHEN statut = 'en_retard' THEN 1 END) as nb_retard,
      COALESCE(SUM(CASE WHEN statut = 'en_retard' THEN montant_ttc END), 0) as montant_retard
    FROM factures
    WHERE type = 'facture'
    AND created_at >= date('now', '-${mois} months')
  `).get();
  res.json(data);
});

module.exports = router;