// server/routes/analytics.js
// MODULE ANALYTIQUE — Aide à la décision commerciale

const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// ─── Fonction utilitaire formatage montant ───────────────────────────────────
function formatMontant(montant) {
  const n = Math.round(Number(montant) || 0);
  let s = n.toString();
  let result = '';
  let count = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) result = ' ' + result;
    result = s[i] + result;
    count++;
  }
  return result + ' XOF';
}

// ─── 1. SCORING DES OPPORTUNITÉS ────────────────────────────────────────────
router.get('/scoring', (req, res) => {
  const opportunites = db.prepare(`
    SELECT
      o.id, o.titre, o.etape, o.montant, o.probabilite,
      o.date_cloture_prevue, o.created_at,
      c.nom AS contact_nom, c.entreprise,
      u.nom AS commercial
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    LEFT JOIN users u ON u.id = o.owner_id
    WHERE o.etape NOT IN ('gagne', 'perdu')
  `).all();

  const pointsEtape = {
    'prospect':      10,
    'qualification': 25,
    'proposition':   45,
    'negociation':   65,
    'closing':       80
  };

  const scored = opportunites.map(o => {
    let score = 0;
    const aujourdhui = new Date();
    const creeLe = new Date(o.created_at);
    const joursDepuisCreation = Math.floor((aujourdhui - creeLe) / (1000 * 60 * 60 * 24));

    score += pointsEtape[o.etape] || 0;
    score += Math.round((o.probabilite || 0) / 10);

    if (joursDepuisCreation > 60) score -= 20;
    else if (joursDepuisCreation > 30) score -= 10;

    if (o.montant >= 500000) score += 10;

    score = Math.max(0, Math.min(100, score));

    let priorite;
    if (score >= 70)      priorite = 'haute';
    else if (score >= 40) priorite = 'moyenne';
    else                  priorite = 'faible';

    return { ...o, score, priorite, jours_depuis_creation: joursDepuisCreation };
  });

  scored.sort((a, b) => b.score - a.score);
  res.json(scored);
});

// ─── 2. ALERTES INTELLIGENTES ───────────────────────────────────────────────
router.get('/alertes', (req, res) => {
  const alertes = [];

  // Factures en retard
  const facturesRetard = db.prepare(`
    SELECT f.id, f.numero, f.montant_ttc, f.date_echeance,
           c.nom AS contact_nom, c.email
    FROM factures f
    LEFT JOIN contacts c ON c.id = f.contact_id
    WHERE f.type = 'facture'
      AND f.statut NOT IN ('paye', 'annule')
      AND f.date_echeance < date('now')
  `).all();

  facturesRetard.forEach(f => {
    const joursRetard = Math.floor(
      (new Date() - new Date(f.date_echeance)) / (1000 * 60 * 60 * 24)
    );
    alertes.push({
      type: 'facture_retard',
      niveau: joursRetard > 30 ? 'critique' : 'warning',
      titre: `Facture ${f.numero} en retard`,
      message: `${f.contact_nom} — ${formatMontant(f.montant_ttc)} — ${joursRetard} jour(s) de retard`,
      lien: '/factures',
      id_reference: f.id
    });
  });

  // Tâches en retard
  const tachesRetard = db.prepare(`
    SELECT t.id, t.titre, t.date_echeance, t.priorite,
           u.nom AS assignee
    FROM taches t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.statut NOT IN ('termine', 'annule')
      AND t.date_echeance < date('now')
  `).all();

  tachesRetard.forEach(t => {
    alertes.push({
      type: 'tache_retard',
      niveau: t.priorite === 'haute' ? 'critique' : 'warning',
      titre: `Tâche en retard : ${t.titre}`,
      message: `Assignée à ${t.assignee || 'personne'} — échéance dépassée`,
      lien: '/taches',
      id_reference: t.id
    });
  });

  // Opportunités stagnantes
  const oppStagnantes = db.prepare(`
    SELECT o.id, o.titre, o.etape, o.montant, o.updated_at,
           c.nom AS contact_nom,
           u.nom AS commercial
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    LEFT JOIN users u ON u.id = o.owner_id
    WHERE o.etape NOT IN ('gagne', 'perdu')
      AND o.updated_at < date('now', '-30 days')
  `).all();

  oppStagnantes.forEach(o => {
    const joursInactif = Math.floor(
      (new Date() - new Date(o.updated_at)) / (1000 * 60 * 60 * 24)
    );
    alertes.push({
      type: 'opportunite_stagnante',
      niveau: joursInactif > 60 ? 'critique' : 'warning',
      titre: `Opportunité inactive : ${o.titre}`,
      message: `${o.contact_nom} — étape "${o.etape}" — inactive depuis ${joursInactif} jour(s)`,
      lien: '/pipeline',
      id_reference: o.id
    });
  });

  // Clients inactifs
  const clientsInactifs = db.prepare(`
    SELECT c.id, c.nom, c.entreprise, c.updated_at
    FROM contacts c
    WHERE c.type = 'client'
      AND c.updated_at < date('now', '-90 days')
    ORDER BY c.updated_at ASC
    LIMIT 10
  `).all();

  clientsInactifs.forEach(c => {
    const joursInactif = Math.floor(
      (new Date() - new Date(c.updated_at)) / (1000 * 60 * 60 * 24)
    );
    alertes.push({
      type: 'client_inactif',
      niveau: 'info',
      titre: `Client à relancer : ${c.nom}`,
      message: `${c.entreprise || 'Sans entreprise'} — aucune interaction depuis ${joursInactif} jour(s)`,
      lien: '/contacts',
      id_reference: c.id
    });
  });

  const ordre = { critique: 0, warning: 1, info: 2 };
  alertes.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);

  res.json({
    total: alertes.length,
    critique: alertes.filter(a => a.niveau === 'critique').length,
    warning: alertes.filter(a => a.niveau === 'warning').length,
    info: alertes.filter(a => a.niveau === 'info').length,
    alertes
  });
});

// ─── 3. INDICATEURS ENRICHIS AVEC FILTRES ───────────────────────────────────
router.get('/indicateurs', (req, res) => {
  const { periode, commercial_id, secteur } = req.query;

  let dateDebut;
  switch (periode) {
    case 'semaine':   dateDebut = "date('now', '-7 days')";   break;
    case 'trimestre': dateDebut = "date('now', '-3 months')"; break;
    case 'annee':     dateDebut = "date('now', '-1 year')";   break;
    default:          dateDebut = "date('now', '-1 month')";
  }

  const filtreCommercial = commercial_id ? `AND o.owner_id = ${parseInt(commercial_id)}` : '';
  const filtreCommercialContacts = commercial_id ? `AND c.owner_id = ${parseInt(commercial_id)}` : '';
  const filtreSecteur = secteur ? `AND c.secteur = '${secteur.replace(/'/g, "''")}'` : '';

  const totalProspects = db.prepare(`
    SELECT COUNT(*) as c FROM contacts
    WHERE type = 'prospect' AND created_at >= ${dateDebut}
    ${filtreCommercialContacts} ${filtreSecteur}
  `).get().c;

  const totalConvertis = db.prepare(`
    SELECT COUNT(*) as c FROM contacts
    WHERE type = 'client' AND created_at >= ${dateDebut}
    ${filtreCommercialContacts} ${filtreSecteur}
  `).get().c;

  const tauxConversion = totalProspects > 0
    ? Math.round((totalConvertis / (totalProspects + totalConvertis)) * 100)
    : 0;

  const delaiPaiement = db.prepare(`
    SELECT ROUND(AVG(julianday(created_at) - julianday(date_emission)), 1) as delai_moyen
    FROM factures
    WHERE statut = 'paye' AND date_emission >= ${dateDebut}
  `).get().delai_moyen;

  const topServices = db.prepare(`
    SELECT s.titre, s.categorie, COUNT(*) as nb_ventes,
           COALESCE(SUM(cs.tarif_ht), 0) as ca_ht
    FROM contact_services cs
    JOIN services s ON s.id = cs.service_id
    WHERE cs.date_debut >= ${dateDebut}
    GROUP BY s.id
    ORDER BY nb_ventes DESC
    LIMIT 5
  `).all();

  const caPeriode = db.prepare(`
    SELECT COALESCE(SUM(montant_ttc), 0) as total
    FROM factures
    WHERE statut = 'paye' AND date_emission >= ${dateDebut}
  `).get().total;

  const oppCreees = db.prepare(`
    SELECT COUNT(*) as c FROM opportunites
    WHERE created_at >= ${dateDebut} ${filtreCommercial}
  `).get().c;

  const oppGagnees = db.prepare(`
    SELECT COUNT(*) as c FROM opportunites
    WHERE etape = 'gagne' AND updated_at >= ${dateDebut} ${filtreCommercial}
  `).get().c;

  const commerciaux = db.prepare(`
    SELECT id, nom FROM users
    WHERE role IN ('commercial', 'manager', 'admin')
    ORDER BY nom
  `).all();

  const secteurs = db.prepare(`
    SELECT DISTINCT secteur FROM contacts
    WHERE secteur IS NOT NULL AND secteur != ''
    ORDER BY secteur
  `).all().map(s => s.secteur);

  res.json({
    periode: periode || 'mois',
    filtres: { commercial_id: commercial_id || null, secteur: secteur || null },
    indicateurs: {
      taux_conversion: tauxConversion,
      delai_moyen_paiement: delaiPaiement || 0,
      ca_periode: caPeriode,
      opp_creees: oppCreees,
      opp_gagnees: oppGagnees,
      top_services: topServices
    },
    meta: { commerciaux, secteurs }
  });
});

module.exports = router;