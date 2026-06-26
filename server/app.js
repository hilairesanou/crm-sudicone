// server/app.js
// MOTEUR PRINCIPAL DU CRM
// Express + SQLite + sessions
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { requireAuth } = require('./middleware/auth');

const authRoutes          = require('./routes/auth');
const contactsRoutes      = require('./routes/contacts');
const opportunitesRoutes  = require('./routes/opportunites');
const facturesRoutes      = require('./routes/factures');
const tachesRoutes        = require('./routes/taches');
const statsRoutes         = require('./routes/stats');
const usersRoutes         = require('./routes/users');
const servicesRoutes      = require('./routes/services');
const workflowsRoutes     = require('./routes/workflows');
const departmentsRoutes   = require('./routes/departments');
const exportRoutes        = require('./routes/export');
const publicRoutes        = require('./routes/public');
const analyticsRoutes     = require('./routes/analytics');
const notificationsRoutes = require('./routes/notifications');
const { lancerAutomations, regle_opportuniteGagnee, regle_nouveauClient } = require('./utils/automations');
const importRoutes = require('./routes/import');
const db                    = require('./db/connection');
const { envoyerRappelFacture } = require('./utils/mailer');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Sécurité : Helmet ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
}));

// ── Sécurité : Rate limiting ─────────────────────────────────────────────────
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' }
});
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes.' }
});
app.use('/api/', limiterGeneral);
app.use('/api/auth/login', limiterAuth);

// ── Middlewares globaux ──────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_a_changer',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
    httpOnly: true
  }
}));

// ── Routes API publiques ─────────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/public', publicRoutes);

// ── Routes API protégées ─────────────────────────────────────────────────────
app.get('/analytique', requireAuth, (req, res) => {
  if (req.session.role === 'commercial') {
    return res.redirect('/dashboard?acces=refuse');
  }
  res.sendFile(path.join(__dirname, '../public/pages/analytique.html'));
});
app.use('/api/contacts',      requireAuth, contactsRoutes);
app.use('/api/opportunites',  requireAuth, opportunitesRoutes);
app.use('/api/factures',      requireAuth, facturesRoutes);
app.use('/api/taches',        requireAuth, tachesRoutes);
app.use('/api/services',      requireAuth, servicesRoutes);
app.use('/api/workflows',     requireAuth, workflowsRoutes);
app.use('/api/departments',   requireAuth, departmentsRoutes);
app.use('/api/export',        requireAuth, exportRoutes);
app.use('/api/stats',         requireAuth, statsRoutes);
app.use('/api/users',         requireAuth, usersRoutes);
app.use('/api/notifications', requireAuth, notificationsRoutes);
app.use('/api/import', requireAuth, importRoutes);

// ── Fichiers statiques ───────────────────────────────────────────────────────
app.use('/vendor/chartjs', express.static(path.join(__dirname, '../node_modules/chart.js/dist')));
app.use(express.static(path.join(__dirname, '../public')));

// ── Pages protégées ──────────────────────────────────────────────────────────
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/dashboard.html'));
});

const pagesProtegees = [
  'contacts', 'pipeline', 'services', 'workflows',
  'organigramme', 'factures', 'taches', 'utilisateurs', 'analytique'
];
pagesProtegees.forEach(page => {
  app.get(`/${page}`, requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, `../public/pages/${page}.html`));
  });
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/dashboard.html'));
});

// ── Gestion des erreurs ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// ── Job automatique : factures en retard + rappels email ─────────────────────
async function majFacturesEnRetard() {
  try {
    // 1. Factures qui viennent de passer en retard
    const facturesEchues = db.prepare(`
      SELECT f.*, c.nom as contact_nom, c.email as contact_email
      FROM factures f
      LEFT JOIN contacts c ON c.id = f.contact_id
      WHERE f.type     = 'facture'
        AND f.statut   = 'envoye'
        AND f.date_echeance < date('now')
        AND f.date_echeance IS NOT NULL
    `).all();

    if (facturesEchues.length > 0) {
      console.log(`⏰ Job factures : ${facturesEchues.length} facture(s) à passer en retard`);

      for (const facture of facturesEchues) {
        // Mettre à jour le statut
        db.prepare(`UPDATE factures SET statut = 'en_retard' WHERE id = ?`).run(facture.id);

        // Envoyer email de rappel au client
        await envoyerRappelFacture(facture);

        // Notifier l'admin dans le CRM
        const admin = db.prepare(
          `SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
        ).get();

        if (admin) {
          const joursRetard = Math.floor(
            (new Date() - new Date(facture.date_echeance)) / (1000 * 60 * 60 * 24)
          );
          db.prepare(`
            INSERT INTO notifications (type, titre, message, contact_id, destinataire_id)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            'facture_retard',
            `⚠️ Facture ${facture.numero} en retard`,
            `${facture.contact_nom || 'Client'} — ${Number(facture.montant_ttc || 0).toLocaleString('fr-FR')} XOF — ${joursRetard} jour(s) de retard`,
            facture.contact_id,
            admin.id
          );
        }
      }
    }

    // 2. Factures déjà en retard — rappel tous les 7 jours
    const facturesDejaEnRetard = db.prepare(`
      SELECT f.*, c.nom as contact_nom, c.email as contact_email
      FROM factures f
      LEFT JOIN contacts c ON c.id = f.contact_id
      WHERE f.type   = 'facture'
        AND f.statut = 'en_retard'
        AND f.date_echeance IS NOT NULL
        AND c.email IS NOT NULL
        AND CAST(julianday('now') - julianday(f.date_echeance) AS INTEGER) % 7 = 0
        AND CAST(julianday('now') - julianday(f.date_echeance) AS INTEGER) > 0
    `).all();

    for (const facture of facturesDejaEnRetard) {
      await envoyerRappelFacture(facture);
    }

  } catch (err) {
    console.error('Erreur job factures:', err.message);
  }
}

// ── Démarrage serveur ────────────────────────────────────────────────────────
const server = app.listen(PORT, async () => {
  console.log(`✓ CRM démarré sur http://localhost:${PORT}`);

  // Lancer le job au démarrage
  await majFacturesEnRetard();

  // Puis toutes les heures
  setInterval(majFacturesEnRetard, 60 * 60 * 1000);
});

// Lancer les automations au démarrage puis toutes les heures
lancerAutomations();
setInterval(lancerAutomations, 60 * 60 * 1000);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} déjà utilisé.`);
    process.exit(1);
  }
  console.error('Erreur serveur:', err);
  process.exit(1);
});