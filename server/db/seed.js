const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./connection');

const services = [
  { code: 'COM055', titre: 'Stratégie de communication', categorie: 'Stratégie', description: 'Audit et construction de stratégie de communication multicanal.', prix_ht: 250000, duree_mois: 3 },
  { code: 'DIG040', titre: 'Gestion des réseaux sociaux', categorie: 'Digital', description: 'Animation quotidienne des réseaux sociaux et gestion de communauté.', prix_ht: 180000, duree_mois: 1 },
  { code: 'WEB070', titre: 'Site web vitrine', categorie: 'Web', description: 'Création de site web vitrine responsive.', prix_ht: 420000, duree_mois: 1 },
  { code: 'SEO025', titre: 'Référencement SEO', categorie: 'Digital', description: 'Optimisation SEO on-page pour le référencement naturel.', prix_ht: 120000, duree_mois: 12 },
  { code: 'PUB020', titre: 'Campagne publicitaire', categorie: 'Publicité', description: 'Lancement et optimisation de campagnes publicitaires en ligne.', prix_ht: 200000, duree_mois: 1 },
  { code: 'BRD030', titre: 'Charte graphique', categorie: 'Design', description: 'Conception de charte graphique professionnelle.', prix_ht: 150000, duree_mois: 1 },
  { code: 'VID060', titre: 'Production vidéo', categorie: 'Video', description: 'Réalisation de vidéos promotionnelles et corporate.', prix_ht: 360000, duree_mois: 1 },
  { code: 'EVT050', titre: 'Événementiel', categorie: 'Événementiel', description: 'Organisation d\'événements et activations terrain.', prix_ht: 500000, duree_mois: 1 }
];

const packs = [
  { nom: 'Pack Starter', description: 'Pack démarrage: site web vitrine + gestion de réseaux sociaux + charte graphique.', prix_ht: 680000, duree_mois: 3, service_codes: ['WEB070', 'DIG040', 'BRD030'] },
  { nom: 'Pack Pro', description: 'Pack Pro: stratégie, SEO et campagne publicitaire.', prix_ht: 520000, duree_mois: 6, service_codes: ['COM055', 'SEO025', 'PUB020'] },
  { nom: 'Pack Entreprise', description: 'Solution complète SUDICONE pour communication globale.', prix_ht: 980000, duree_mois: 12, service_codes: ['COM055', 'WEB070', 'SEO025', 'DIG040', 'BRD030'] }
];

const departments = [
  { nom: 'Direction Générale', parent_id: null, description: 'Direction et pilotage stratégique', responsable: 'Mohamed K.', telephone: '+226 70 00 00 01' },
  { nom: 'Marketing & Communication', parent_id: 1, description: 'Stratégie de communication, digital et publicité.', responsable: 'Amina D.', telephone: '+226 70 00 00 02' },
  { nom: 'Production', parent_id: 1, description: 'Création de contenus, vidéos et design.', responsable: 'Issa B.', telephone: '+226 70 00 00 03' },
  { nom: 'Commercial', parent_id: 1, description: 'Ventes, suivi clients et relations partenaires.', responsable: 'Fatou S.', telephone: '+226 70 00 00 04' }
];

const users = [
  { nom: 'Administrateur', email: 'admin@sudicone.bf', password: 'ChangeMoi123!', role: 'admin' },
  { nom: 'Amina Diarra', email: 'amina.d@sudicone.bf', password: 'Admin1234', role: 'manager' },
  { nom: 'Issa B.', email: 'issa.b@sudicone.bf', password: 'Admin1234', role: 'manager' },
  { nom: 'Karim T.', email: 'karim.t@sudicone.bf', password: 'Commercial123', role: 'commercial' },
  { nom: 'Sophie Z.', email: 'sophie.z@sudicone.bf', password: 'Commercial123', role: 'commercial' }
];

const contactTypes = ['client', 'prospect', 'partenaire'];
const statutClients = ['actif', 'prospect', 'partenaire', 'ancien', 'suspendu'];
const villes = ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Ouahigouya', 'Tenkodogo'];
const secteurs = ['Agroalimentaire', 'Finance', 'Retail', 'Technologie', 'Éducation', 'Santé'];
const servicesById = {};
const packsById = {};

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

console.log('Injection des données de base SUDICONE...');

services.forEach(s => {
  db.prepare('INSERT OR IGNORE INTO services (code, titre, categorie, description, prix_ht, duree_mois) VALUES (?, ?, ?, ?, ?, ?)')
    .run(s.code, s.titre, s.categorie, s.description, s.prix_ht, s.duree_mois);
});

const servicesRows = db.prepare('SELECT * FROM services').all();
servicesRows.forEach(s => servicesById[s.code] = s.id);

packs.forEach(p => {
  const result = db.prepare('INSERT INTO service_packs (nom, description, prix_ht, duree_mois) VALUES (?, ?, ?, ?)')
    .run(p.nom, p.description, p.prix_ht, p.duree_mois);
  packsById[p.nom] = result.lastInsertRowid;
  p.service_codes.forEach(code => {
    const serviceId = servicesById[code];
    if (serviceId) {
      db.prepare('INSERT OR IGNORE INTO pack_services (pack_id, service_id) VALUES (?, ?)').run(result.lastInsertRowid, serviceId);
    }
  });
});

departments.forEach(d => {
  db.prepare('INSERT OR IGNORE INTO departments (nom, parent_id, description, responsable, telephone) VALUES (?, ?, ?, ?, ?)')
    .run(d.nom, d.parent_id, d.description, d.responsable, d.telephone);
});

users.forEach(u => {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
  if (!existing) {
    const hash = bcrypt.hashSync(u.password, 10);
    db.prepare('INSERT INTO users (nom, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(u.nom, u.email, hash, u.role);
  }
});

const userRows = db.prepare('SELECT * FROM users').all();
const contactsRows = db.prepare('SELECT * FROM contacts').all();

const nombres = ['Yacouba', 'Awa', 'Ibrahim', 'Rashida', 'Mahamadou', 'Salimata', 'Ousmane', 'Mariama', 'Adama', 'Fatoumata'];
const entreprises = ['Sudicome', 'NovaCom', 'MediaPlus', 'GreenPulse', 'BizConnect', 'DigitalWave', 'AfriVision'];

function randomDate(start, end) {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().slice(0, 10);
}

function createNumero(type, year) {
  const prefix = type === 'facture' ? 'FAC' : 'DEV';
  const count = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE type = ? AND strftime('%Y', date_emission) = ?`).get(type, String(year)).c;
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

const etapes = ['nouveau', 'qualification', 'proposition', 'negociation', 'gagne', 'perdu'];
const statutFactures = {
  facture: ['brouillon', 'envoye', 'paye', 'en_retard', 'annule'],
  devis: ['brouillon', 'envoye', 'annule']
};
const priorites = ['basse', 'normale', 'haute', 'urgente'];
const workflowStatuses = ['en_cours', 'termine', 'bloque'];

function randomStatus(type) {
  if (type === 'facture') return randomChoice(statutFactures.facture);
  return randomChoice(statutFactures.devis);
}

function randomProbabilite(etape) {
  const map = { nouveau: 10, qualification: 30, proposition: 55, negociation: 75, gagne: 100, perdu: 0 };
  return map[etape] ?? 20;
}

const lignesModeles = [
  'Audit de positionnement',
  'Campagne marketing digital',
  'Réalisation de site web',
  'Création de contenus',
  'Pack communication',
  'Gestion de projet',
  'Conseil stratégique',
  'Maintenance technique'
];

function createLignes() {
  const count = randomInt(1, 4);
  return Array.from({ length: count }, () => {
    const designation = randomChoice(lignesModeles);
    const quantite = randomChoice([1, 1, 2, 3]);
    const prix_unitaire = randomChoice([120000, 180000, 250000, 320000, 450000]);
    return { designation, quantite, prix_unitaire, total: quantite * prix_unitaire };
  });
}

// ── 100 Contacts ─────────────────────────────────────────────────────────────
for (let i = 1; i <= 100; i++) {
  const nom = `${randomChoice(nombres)} ${String.fromCharCode(65 + (i % 26))}`;
  const entreprise = randomChoice(entreprises);
  const type = randomChoice(contactTypes);
  const statut_client = randomChoice(statutClients);
  const ville = randomChoice(villes);
  const secteur = randomChoice(secteurs);
  const code_client = `SUD-${String(i).padStart(4, '0')}`;
  const email = `${nom.toLowerCase().replace(/ /g, '.')}@${entreprise.toLowerCase()}.bf`;
  const responsable = randomChoice(nombres) + ' ' + String.fromCharCode(65 + ((i + 1) % 26));
  const siret = `BF${randomInt(10000000, 99999999)}${randomInt(1000, 9999)}`;
  const date_entree = `202${randomInt(0, 3)}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`;
  const date_renouvellement = `202${randomInt(2, 4)}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`;
  const mode_paiement = randomChoice(['Virement', 'Carte', 'Chèque', 'Prélèvement']);
  const note_technique = `Infrastructure ${randomChoice(['web', 'mobile', 'cross-platform'])}, niveau ${randomChoice(['standard', 'avancé', 'expert'])}.`;
  const note_comptable = `Paiement ${randomChoice(['à jour', 'en retard', 'partiel'])}, condition ${randomChoice(['net 30', 'net 60', 'au comptant'])}.`;

  const result = db.prepare(
    `INSERT OR IGNORE INTO contacts (type, nom, entreprise, email, telephone, adresse, ville, pays, siret, secteur, site_web, code_client, responsable, statut_client, date_entree, date_renouvellement, mode_paiement, note_technique, note_comptable, notes, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    type, nom, entreprise, email,
    `+226 70 ${randomInt(10, 99)} ${randomInt(10, 99)}`,
    `${randomInt(10, 99)} rue de la Paix`,
    ville, 'Burkina Faso', siret, secteur,
    entreprise.toLowerCase() + '.bf',
    code_client, responsable, statut_client,
    date_entree, date_renouvellement, mode_paiement,
    note_technique, note_comptable,
    `Données de test pour ${i}`,
    randomChoice(userRows).id
  );

  const contactId = result.lastInsertRowid || db.prepare('SELECT id FROM contacts WHERE code_client = ?').get(code_client).id;

  if (i % 4 === 0) {
    const serviceId = servicesRows[randomInt(0, servicesRows.length - 1)].id;
    db.prepare('INSERT OR IGNORE INTO contact_services (contact_id, service_id, statut, date_debut, date_fin, tarif_ht, renouvellement_auto) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(contactId, serviceId, 'actif', date_entree, date_renouvellement, randomChoice([100000, 180000, 250000]), 1);
  }
  if (i % 5 === 0) {
    const packId = packsById[randomChoice(packs).nom];
    db.prepare('INSERT OR IGNORE INTO contact_packs (contact_id, pack_id, statut, date_debut, date_fin, tarif_ht) VALUES (?, ?, ?, ?, ?, ?)')
      .run(contactId, packId, 'actif', date_entree, date_renouvellement, randomChoice([520000, 680000, 980000]));
  }
}

const allContacts = db.prepare('SELECT * FROM contacts').all();
const allUsers = db.prepare('SELECT * FROM users').all();

// ── 120 Opportunités — devise forcée XOF ─────────────────────────────────────
const opportunitesIds = [];
for (let i = 1; i <= 120; i++) {
  const contact = randomChoice(allContacts);
  const etape = randomChoice(etapes);
  const montant = randomChoice([90000, 150000, 250000, 380000, 520000, 780000, 1020000]);
  const date_cloture_prevue = randomDate(new Date(2024, 0, 1), new Date(2025, 11, 31));
  const result = db.prepare(
    `INSERT INTO opportunites (titre, contact_id, montant, devise, etape, probabilite, date_cloture_prevue, notes, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `${randomChoice(['Proposition', 'Offre', 'Audit', 'Refonte', 'Campagne'])} ${randomChoice(['SUDICONE', 'NovaCom', 'MediaPlus'])}`,
    contact.id,
    montant,
    'XOF', // ← forcé XOF uniquement
    etape,
    randomProbabilite(etape),
    date_cloture_prevue,
    `Opportunité créée pour ${contact.nom}`,
    randomChoice(allUsers).id
  );
  opportunitesIds.push(result.lastInsertRowid);
}

// ── 120 Factures/Devis ────────────────────────────────────────────────────────
for (let i = 1; i <= 120; i++) {
  const contact = randomChoice(allContacts);
  const type = randomChoice(['devis', 'facture']);
  const lignes = createLignes();
  const montant_ht = lignes.reduce((sum, ligne) => sum + ligne.total, 0);
  const taux_tva = 18;
  const montant_ttc = montant_ht * (1 + taux_tva / 100);
  const date_emission = randomDate(new Date(2024, 0, 1), new Date());
  const date_echeance = randomDate(new Date(date_emission), new Date(2025, 11, 31));
  const statut = randomStatus(type);
  const opportunite_id = Math.random() < 0.6 ? randomChoice(opportunitesIds) : null;
  const numero = createNumero(type, new Date(date_emission).getFullYear());

  const result = db.prepare(
    `INSERT INTO factures (numero, type, contact_id, opportunite_id, statut, montant_ht, taux_tva, montant_ttc, date_emission, date_echeance, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    numero, type, contact.id, opportunite_id, statut,
    montant_ht, taux_tva, montant_ttc,
    date_emission, date_echeance,
    randomChoice(allUsers).id
  );

  const factureId = result.lastInsertRowid;
  lignes.forEach(ligne => {
    db.prepare('INSERT INTO facture_lignes (facture_id, designation, quantite, prix_unitaire, total) VALUES (?, ?, ?, ?, ?)')
      .run(factureId, ligne.designation, ligne.quantite, ligne.prix_unitaire, ligne.total);
  });
}

// ── 120 Tâches ────────────────────────────────────────────────────────────────
for (let i = 1; i <= 120; i++) {
  const contact = randomChoice(allContacts);
  const opportunite_id = Math.random() < 0.5 ? randomChoice(opportunitesIds) : null;
  db.prepare(
    `INSERT INTO taches (titre, description, contact_id, opportunite_id, statut, priorite, date_echeance, assigned_to)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `Suivi ${randomChoice(['client', 'opportunité', 'projet', 'facturation'])} ${i}`,
    `Tâche de suivi pour ${contact.nom}`,
    contact.id, opportunite_id,
    randomChoice(['a_faire', 'en_cours', 'terminee', 'annulee']),
    randomChoice(priorites),
    randomDate(new Date(), new Date(2025, 11, 31)),
    randomChoice(allUsers).id
  );
}

// ── 40 Workflows ──────────────────────────────────────────────────────────────
for (let i = 1; i <= 40; i++) {
  const contact = randomChoice(allContacts);
  const statut = randomChoice(workflowStatuses);
  const owner = randomChoice(allUsers);
  const date_debut = randomDate(new Date(2024, 0, 1), new Date());
  const date_fin_prevue = randomDate(new Date(date_debut), new Date(2025, 11, 31));
  const result = db.prepare(
    `INSERT INTO workflows (titre, description, contact_id, statut, owner_id, date_debut, date_fin_prevue)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `Workflow ${i} ${randomChoice(['ganche', 'marketing', 'tech'])}`,
    `Workflow pour ${contact.nom}`,
    contact.id, statut, owner.id, date_debut, date_fin_prevue
  );

  const workflowId = result.lastInsertRowid;
  const stepCount = randomInt(2, 5);
  for (let j = 1; j <= stepCount; j++) {
    db.prepare(
      `INSERT INTO workflow_steps (workflow_id, titre, description, statut, ordre, assigned_to, date_debut, date_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      workflowId, `Étape ${j}`, `Étape ${j}`,
      randomChoice(['a_faire', 'en_cours', 'terminee']),
      j, randomChoice(allUsers).id,
      randomDate(new Date(date_debut), new Date(date_fin_prevue)),
      randomDate(new Date(date_debut), new Date(date_fin_prevue))
    );
  }
}

console.log('✓ Données fictives insérées : 100 contacts, services, packs, départements, opportunités, documents, tâches et workflows.');