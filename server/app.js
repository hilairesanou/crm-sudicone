// server/app.js
// MOTEUR PRINCIPAL DU CRM
// Express + SQLite + sessions — remplace l'écosystème Django pour ce projet

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const { requireAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const opportunitesRoutes = require('./routes/opportunites');
const facturesRoutes = require('./routes/factures');
const tachesRoutes = require('./routes/taches');
const statsRoutes = require('./routes/stats');
const usersRoutes = require('./routes/users');
const servicesRoutes = require('./routes/services');
const workflowsRoutes = require('./routes/workflows');
const departmentsRoutes = require('./routes/departments');
const exportRoutes = require('./routes/export');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middlewares globaux ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_a_changer',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
    httpOnly: true
  }
}));

// --- Routes API publiques (pas besoin d'être connecté) ---
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);

// --- Routes API protégées (auth requise) ---
app.use('/api/contacts', requireAuth, contactsRoutes);
app.use('/api/opportunites', requireAuth, opportunitesRoutes);
app.use('/api/factures', requireAuth, facturesRoutes);
app.use('/api/taches', requireAuth, tachesRoutes);
app.use('/api/services', requireAuth, servicesRoutes);
app.use('/api/workflows', requireAuth, workflowsRoutes);
app.use('/api/departments', requireAuth, departmentsRoutes);
app.use('/api/export', requireAuth, exportRoutes);
app.use('/api/stats', requireAuth, statsRoutes);
app.use('/api/users', requireAuth, usersRoutes);

// --- Fichiers statiques (HTML/CSS/JS du front) ---
app.use('/vendor/chartjs', express.static(path.join(__dirname, '../node_modules/chart.js/dist')));
// login.html et le CSS de base restent accessibles sans connexion
app.use(express.static(path.join(__dirname, '../public')));

// --- Protection des pages HTML internes ---
// Toute page autre que login.html nécessite une session active
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/dashboard.html'));
});

const pagesProtegees = ['contacts', 'pipeline', 'services', 'workflows', 'organigramme', 'factures', 'taches', 'utilisateurs'];
pagesProtegees.forEach(page => {
  app.get(`/${page}`, requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, `../public/pages/${page}.html`));
  });
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/dashboard.html'));
});

// --- Gestion des erreurs ---
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

const server = app.listen(PORT, () => {
  console.log(`✓ CRM démarré sur http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} déjà utilisé. Arrêtez l'autre instance ou définissez PORT dans votre environnement.`);
    process.exit(1);
  }
  console.error('Erreur serveur non gérée :', err);
  process.exit(1);
});
