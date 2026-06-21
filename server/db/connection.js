// server/db/connection.js
// Connexion centrale à la base SQLite (better-sqlite3 = synchrone, simple, rapide)

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/crm.db');

// S'assure que le dossier data existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // meilleures perfs en écriture concurrente
db.pragma('foreign_keys = ON');

module.exports = db;
