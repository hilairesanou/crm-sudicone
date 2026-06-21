// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND actif = 1').get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.nom = user.nom;

  res.json({
    ok: true,
    user: { id: user.id, nom: user.nom, email: user.email, role: user.role }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const user = db.prepare('SELECT id, nom, email, role FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

module.exports = router;
