// server/utils/automations.js
// Moteur de règles CRM — automatisations intelligentes
// Principe : SI [condition] ALORS [action]

const db = require('../db/connection');
const { logActivite } = require('./activite');

// ── Utilitaire : créer une tâche automatique ──────────────────────────────────
function creerTacheAuto(titre, description, contactId, opportuniteId, assigneId, priorite = 'haute') {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateEcheance = demain.toISOString().split('T')[0];

  const existing = db.prepare(`
    SELECT id FROM taches
    WHERE titre = ? AND contact_id = ? AND statut NOT IN ('terminee', 'annulee')
  `).get(titre, contactId);

  if (existing) return null; // Éviter les doublons

  const result = db.prepare(`
    INSERT INTO taches (titre, description, contact_id, opportunite_id,
      statut, priorite, date_echeance, assigned_to)
    VALUES (?, ?, ?, ?, 'a_faire', ?, ?, ?)
  `).run(titre, description, contactId || null, opportuniteId || null,
         priorite, dateEcheance, assigneId);

  logActivite(
    'tache_auto',
    `Tâche automatique créée : "${titre}"`,
    contactId, assigneId
  );

  return result.lastInsertRowid;
}

// ── Utilitaire : notifier l'admin ─────────────────────────────────────────────
function notifierAdmin(type, titre, message, contactId, opportuniteId) {
  const admin = db.prepare(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
  ).get();
  if (!admin) return;

  db.prepare(`
    INSERT INTO notifications (type, titre, message, contact_id,
      opportunite_id, destinataire_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(type, titre, message, contactId || null, opportuniteId || null, admin.id);
}

// ── Utilitaire : trouver le commercial d'une opportunité ──────────────────────
function getCommercial(opportunite) {
  if (opportunite.owner_id) return opportunite.owner_id;
  const admin = db.prepare(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
  ).get();
  return admin ? admin.id : null;
}

// ════════════════════════════════════════════════════════════════════════════════
// RÈGLE 1 — Opportunité proche de la clôture
// SI étape = proposition OU negociation
// ET date_cloture_prevue < 7 jours
// ALORS créer tâche "Relancer le client"
// ════════════════════════════════════════════════════════════════════════════════
function regle_opportuniteProche() {
  const opportunites = db.prepare(`
    SELECT o.*, c.nom as contact_nom
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    WHERE o.etape IN ('proposition', 'negociation')
      AND o.date_cloture_prevue IS NOT NULL
      AND o.date_cloture_prevue BETWEEN date('now') AND date('now', '+7 days')
  `).all();

  let declenchements = 0;

  for (const opp of opportunites) {
    const commercialId = getCommercial(opp);
    const joursRestants = Math.ceil(
      (new Date(opp.date_cloture_prevue) - new Date()) / (1000 * 60 * 60 * 24)
    );

    const tacheId = creerTacheAuto(
      `Relancer le client : ${opp.titre}`,
      `L'opportunité "${opp.titre}" arrive à échéance dans ${joursRestants} jour(s).\nÉtape actuelle : ${opp.etape}\nContact : ${opp.contact_nom || 'Non défini'}`,
      opp.contact_id,
      opp.id,
      commercialId,
      'haute'
    );

    if (tacheId) {
      notifierAdmin(
        'automation',
        `⏰ Opportunité à relancer : ${opp.titre}`,
        `Échéance dans ${joursRestants} jour(s) — étape "${opp.etape}"`,
        opp.contact_id,
        opp.id
      );
      declenchements++;
    }
  }

  if (declenchements > 0) {
    console.log(`🤖 Règle 1 : ${declenchements} relance(s) créée(s)`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// RÈGLE 2 — Opportunité gagnée
// SI étape passe à "gagne"
// ALORS créer tâche "Préparer le contrat" + notifier admin
// ════════════════════════════════════════════════════════════════════════════════
function regle_opportuniteGagnee(opportuniteId) {
  const opp = db.prepare(`
    SELECT o.*, c.nom as contact_nom
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    WHERE o.id = ?
  `).get(opportuniteId);

  if (!opp || opp.etape !== 'gagne') return;

  const admin = db.prepare(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
  ).get();
  const adminId = admin ? admin.id : getCommercial(opp);

  creerTacheAuto(
    `Préparer le contrat : ${opp.titre}`,
    `L'opportunité "${opp.titre}" vient d'être gagnée !\nMontant : ${Number(opp.montant || 0).toLocaleString('fr-FR')} XOF\nContact : ${opp.contact_nom || 'Non défini'}\n\nActions à faire :\n- Rédiger le contrat\n- Envoyer la facture\n- Planifier le démarrage`,
    opp.contact_id,
    opp.id,
    adminId,
    'urgente'
  );

  notifierAdmin(
    'opportunite_gagnee',
    `🎉 Opportunité gagnée : ${opp.titre}`,
    `${opp.contact_nom || 'Client'} — ${Number(opp.montant || 0).toLocaleString('fr-FR')} XOF`,
    opp.contact_id,
    opp.id
  );

  console.log(`🤖 Règle 2 : opportunité gagnée → tâche contrat créée (${opp.titre})`);
}

// ════════════════════════════════════════════════════════════════════════════════
// RÈGLE 3 — Nouveau client
// SI contact passe de "prospect" à "client"
// ALORS créer tâche "Onboarding client"
// ════════════════════════════════════════════════════════════════════════════════
function regle_nouveauClient(contactId, ancienType, nouveauType) {
  if (ancienType !== 'prospect' || nouveauType !== 'client') return;

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  if (!contact) return;

  const commercialId = contact.owner_id || db.prepare(
    `SELECT id FROM users WHERE role IN ('commercial', 'admin') ORDER BY id ASC LIMIT 1`
  ).get()?.id;

  creerTacheAuto(
    `Onboarding client : ${contact.nom}`,
    `${contact.nom} vient de devenir client !\n\nActions à faire :\n- Envoyer email de bienvenue\n- Présenter l'équipe SUDICONE\n- Planifier la réunion de démarrage\n- Créer les accès si nécessaire`,
    contactId,
    null,
    commercialId,
    'haute'
  );

  notifierAdmin(
    'nouveau_client',
    `🎊 Nouveau client : ${contact.nom}`,
    `${contact.entreprise ? contact.entreprise + ' — ' : ''}${contact.email || contact.telephone || ''}`,
    contactId,
    null
  );

  console.log(`🤖 Règle 3 : nouveau client → tâche onboarding créée (${contact.nom})`);
}

// ════════════════════════════════════════════════════════════════════════════════
// RÈGLE 4 — Devis sans réponse depuis 7 jours
// SI devis envoyé depuis > 7 jours ET statut toujours "envoye"
// ALORS créer tâche "Relancer le devis"
// ════════════════════════════════════════════════════════════════════════════════
function regle_devisSansReponse() {
  const devis = db.prepare(`
    SELECT f.*, c.nom as contact_nom, c.email as contact_email
    FROM factures f
    LEFT JOIN contacts c ON c.id = f.contact_id
    WHERE f.type   = 'devis'
      AND f.statut = 'envoye'
      AND f.date_emission <= date('now', '-7 days')
  `).all();

  let declenchements = 0;

  for (const d of devis) {
    const joursEcoules = Math.floor(
      (new Date() - new Date(d.date_emission)) / (1000 * 60 * 60 * 24)
    );

    const commercialId = d.owner_id || db.prepare(
      `SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
    ).get()?.id;

    const tacheId = creerTacheAuto(
      `Relancer le devis : ${d.numero}`,
      `Le devis ${d.numero} envoyé à ${d.contact_nom || 'un client'} est sans réponse depuis ${joursEcoules} jour(s).\nMontant : ${Number(d.montant_ttc || 0).toLocaleString('fr-FR')} XOF TTC\n\nActions à faire :\n- Appeler le client\n- Vérifier si le devis a été reçu\n- Proposer une modification si nécessaire`,
      d.contact_id,
      null,
      commercialId,
      'normale'
    );

    if (tacheId) declenchements++;
  }

  if (declenchements > 0) {
    console.log(`🤖 Règle 4 : ${declenchements} relance(s) de devis créée(s)`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// MOTEUR PRINCIPAL — Lance toutes les règles périodiques
// ════════════════════════════════════════════════════════════════════════════════
function lancerAutomations() {
  console.log('🤖 Lancement des automations CRM...');
  try {
    regle_opportuniteProche();
    regle_devisSansReponse();
    console.log('🤖 Automations terminées.');
  } catch (err) {
    console.error('Erreur automations:', err.message);
  }
}

module.exports = {
  lancerAutomations,
  regle_opportuniteGagnee,
  regle_nouveauClient
};