// server/utils/activite.js
const db = require('../db/connection');

function logActivite(type, description, contactId, userId) {
  db.prepare(`
    INSERT INTO activites (type, description, contact_id, user_id)
    VALUES (?, ?, ?, ?)
  `).run(type, description, contactId || null, userId || null);
}

module.exports = { logActivite };
