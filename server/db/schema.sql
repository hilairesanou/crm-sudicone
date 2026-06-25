-- server/db/schema.sql
-- Schéma complet du CRM

-- Utilisateurs (multi-utilisateurs avec rôles)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'commercial' CHECK(role IN ('admin', 'manager', 'commercial')),
  actif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Contacts / Clients
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'prospect' CHECK(type IN ('prospect', 'client', 'partenaire')),
  nom TEXT NOT NULL,
  entreprise TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  ville TEXT,
  pays TEXT DEFAULT 'Burkina Faso',
  siret TEXT,
  secteur TEXT,
  site_web TEXT,
  code_client TEXT UNIQUE,
  responsable TEXT,
  statut_client TEXT NOT NULL DEFAULT 'actif' CHECK(statut_client IN ('actif', 'prospect', 'partenaire', 'ancien', 'suspendu')),
  date_entree TEXT,
  date_renouvellement TEXT,
  mode_paiement TEXT,
  note_technique TEXT,
  note_comptable TEXT,
  notes TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Services et packs
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  titre TEXT NOT NULL,
  categorie TEXT NOT NULL,
  description TEXT,
  prix_ht REAL NOT NULL DEFAULT 0,
  duree_mois INTEGER DEFAULT 1,
  actif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS service_packs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  description TEXT,
  prix_ht REAL NOT NULL DEFAULT 0,
  duree_mois INTEGER DEFAULT 12,
  actif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pack_services (
  pack_id INTEGER NOT NULL REFERENCES service_packs(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY(pack_id, service_id)
);

CREATE TABLE IF NOT EXISTS contact_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'actif' CHECK(statut IN ('actif', 'suspendu', 'termine')),
  date_debut TEXT,
  date_fin TEXT,
  tarif_ht REAL DEFAULT 0,
  renouvellement_auto INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS contact_packs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pack_id INTEGER NOT NULL REFERENCES service_packs(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'actif' CHECK(statut IN ('actif', 'suspendu', 'termine')),
  date_debut TEXT,
  date_fin TEXT,
  tarif_ht REAL DEFAULT 0
);

-- Organigramme interne
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  description TEXT,
  responsable TEXT,
  telephone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Workflows internes
CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  description TEXT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'en_cours' CHECK(statut IN ('en_cours', 'termine', 'bloque')),
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date_debut TEXT,
  date_fin_prevue TEXT,
  date_terminee TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  statut TEXT NOT NULL DEFAULT 'a_faire' CHECK(statut IN ('a_faire', 'en_cours', 'terminee')),
  ordre INTEGER NOT NULL DEFAULT 1,
  date_debut TEXT,
  date_fin TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Pipeline / Opportunités
CREATE TABLE IF NOT EXISTS opportunites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  montant REAL DEFAULT 0,
  devise TEXT DEFAULT 'XOF',
  etape TEXT NOT NULL DEFAULT 'nouveau' CHECK(etape IN ('nouveau', 'qualification', 'proposition', 'negociation', 'gagne', 'perdu')),
  probabilite INTEGER DEFAULT 10,
  date_cloture_prevue TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Factures / Devis
CREATE TABLE IF NOT EXISTS factures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'devis' CHECK(type IN ('devis', 'facture')),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  opportunite_id INTEGER REFERENCES opportunites(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK(statut IN ('brouillon', 'envoye', 'paye', 'en_retard', 'annule')),
  montant_ht REAL DEFAULT 0,
  taux_tva REAL DEFAULT 18,
  montant_ttc REAL DEFAULT 0,
  date_emission TEXT DEFAULT (date('now')),
  date_echeance TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Lignes de facture/devis
CREATE TABLE IF NOT EXISTS facture_lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facture_id INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  quantite REAL DEFAULT 1,
  prix_unitaire REAL DEFAULT 0,
  total REAL DEFAULT 0
);

-- Tâches / Suivi
CREATE TABLE IF NOT EXISTS taches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  description TEXT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  opportunite_id INTEGER REFERENCES opportunites(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'a_faire' CHECK(statut IN ('a_faire', 'en_cours', 'terminee', 'annulee')),
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK(priorite IN ('basse', 'normale', 'haute', 'urgente')),
  date_echeance TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Journal d'activité (utile pour les stats et l'historique)
CREATE TABLE IF NOT EXISTS activites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notifications internes (alertes leads, assignations, etc.)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  titre TEXT NOT NULL,
  message TEXT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  opportunite_id INTEGER REFERENCES opportunites(id) ON DELETE CASCADE,
  tache_id INTEGER REFERENCES taches(id) ON DELETE CASCADE,
  destinataire_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  lu INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);


-- Index utiles pour les perfs
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunites_contact ON opportunites(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunites_etape ON opportunites(etape);
CREATE INDEX IF NOT EXISTS idx_factures_contact ON factures(contact_id);
CREATE INDEX IF NOT EXISTS idx_taches_statut ON taches(statut);
CREATE INDEX IF NOT EXISTS idx_activites_contact ON activites(contact_id);
CREATE INDEX IF NOT EXISTS idx_notifications_destinataire ON notifications(destinataire_id);
CREATE INDEX IF NOT EXISTS idx_notifications_lu ON notifications(lu);
