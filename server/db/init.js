// server/db/init.js
// Initialise la base : crée les tables + un compte admin par défaut
// Usage : node server/db/init.js

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./connection');

console.log('Initialisation de la base de données...');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
console.log('✓ Tables créées.');

function getTableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(col => col.name);
}

function addColumnIfMissing(table, column, definition) {
  const cols = getTableColumns(table);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    console.log(`✓ Colonne ajoutée : ${table}.${column}`);
  }
}

function migrateContactsTable() {
  const contactColumns = [
    ['siret', 'TEXT'],
    ['secteur', 'TEXT'],
    ['site_web', 'TEXT'],
    ['code_client', 'TEXT'],
    ['responsable', 'TEXT'],
    ['statut_client', "TEXT NOT NULL DEFAULT 'actif'"],
    ['date_entree', 'TEXT'],
    ['date_renouvellement', 'TEXT'],
    ['mode_paiement', 'TEXT'],
    ['note_technique', 'TEXT'],
    ['note_comptable', 'TEXT'],
    ['notes', 'TEXT'],
    ['owner_id', 'INTEGER'],
    ['updated_at', "TEXT DEFAULT (datetime('now'))"]
  ];



  contactColumns.forEach(([column, definition]) => {
    addColumnIfMissing('contacts', column, definition);
  });

  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_code_client ON contacts(code_client)').run();
}

migrateContactsTable();

// Création du compte admin par défaut si aucun utilisateur n'existe
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

if (userCount === 0) {
  const defaultEmail = 'admin@sudicone.bf';
  const defaultPassword = 'ChangeMoi123!';
  const hash = bcrypt.hashSync(defaultPassword, 10);

  db.prepare(`
    INSERT INTO users (nom, email, password_hash, role)
    VALUES (?, ?, ?, 'admin')
  `).run('Administrateur', defaultEmail, hash);

  console.log('✓ Compte admin créé :');
  console.log(`  Email    : ${defaultEmail}`);
  console.log(`  Mot de passe : ${defaultPassword}`);
  console.log('  ⚠ Change ce mot de passe immédiatement après ta première connexion.');
} else {
  console.log('✓ Des utilisateurs existent déjà, aucun compte créé.');
}

// Migration : création de la table notifications si absente
db.exec(`
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
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_destinataire ON notifications(destinataire_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_lu ON notifications(lu)`);
console.log('✓ Table notifications vérifiée.');

// Injection de données fictives pour tests et stats
try {
  require('./seed');
} catch (err) {
  console.error('⚠ Échec de l’injection des données fictives :', err.message);
}

console.log('Initialisation terminée.');
