// server/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - liste (admin/manager seulement)
router.get('/', requireRole('admin', 'manager'), (req, res) => {
  const users = db.prepare('SELECT id, nom, email, role, actif, created_at FROM users ORDER BY nom ASC').all();
  res.json(users);
});

// POST /api/users - création (admin seulement)
router.post('/', requireRole('admin'), (req, res) => {
  const { nom, email, password, role } = req.body;
  if (!nom || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (nom, email, password_hash, role) VALUES (?, ?, ?, ?)
  `).run(nom, email, hash, role || 'commercial');

  res.status(201).json({ id: result.lastInsertRowid, nom, email, role: role || 'commercial' });
});

// PUT /api/users/:id - modification (admin seulement)
router.put('/:id', requireRole('admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const { nom, role, actif, password } = req.body;

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  }

  db.prepare(`
    UPDATE users SET nom = ?, role = ?, actif = ? WHERE id = ?
  `).run(nom ?? existing.nom, role ?? existing.role, actif ?? existing.actif, req.params.id);

  res.json({ ok: true });
});

// DELETE /api/users/:id (admin seulement)
router.delete('/:id', requireRole('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: 'Tu ne peux pas supprimer ton propre compte' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
