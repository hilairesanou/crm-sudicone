// server/routes/notifications.js
const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// ── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', (req, res) => {
  const userId = req.session.userId;
  const role   = req.session.role;

  const notifications = role === 'commercial'
    ? db.prepare(`
        SELECT n.*, c.nom AS contact_nom, c.telephone, c.email AS contact_email,
               u.nom AS assigne_a
        FROM notifications n
        LEFT JOIN contacts c ON c.id = n.contact_id
        LEFT JOIN users u ON u.id = n.destinataire_id
        WHERE n.destinataire_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50
      `).all(userId)
    : db.prepare(`
        SELECT n.*, c.nom AS contact_nom, c.telephone, c.email AS contact_email,
               u.nom AS assigne_a
        FROM notifications n
        LEFT JOIN contacts c ON c.id = n.contact_id
        LEFT JOIN users u ON u.id = n.destinataire_id
        ORDER BY n.created_at DESC
        LIMIT 50
      `).all();

  const nonLues = notifications.filter(n => !n.lu).length;
  res.json({ total: notifications.length, non_lues: nonLues, notifications });
});

// ── GET /api/notifications/agents ───────────────────────────────────────────
router.get('/agents', (req, res) => {
  const agents = db.prepare(`
    SELECT id, nom, email, role
    FROM users
    WHERE actif = 1 AND role IN ('commercial', 'manager')
    ORDER BY role, nom
  `).all();

  const agentsAvecCharge = agents.map(agent => {
    const tachesActives = db.prepare(`
      SELECT COUNT(*) as c FROM taches
      WHERE assigned_to = ? AND statut IN ('a_faire', 'en_cours')
    `).get(agent.id).c;

    return {
      ...agent,
      taches_actives: tachesActives,
      disponibilite: tachesActives <= 3 ? 'disponible' : tachesActives <= 7 ? 'chargé' : 'surchargé'
    };
  });

  res.json(agentsAvecCharge);
});

// ── POST /api/notifications/:id/assigner ────────────────────────────────────
router.post('/:id/assigner', (req, res) => {
  // Seul l'admin peut assigner
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
  }

  const { id } = req.params;
  const { agent_id, date_debut, date_fin } = req.body;

  if (!agent_id) return res.status(400).json({ error: 'Agent requis.' });

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!notification) return res.status(404).json({ error: 'Notification introuvable.' });

  const agent = db.prepare('SELECT * FROM users WHERE id = ? AND actif = 1').get(agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });

  if (notification.tache_id) {
    db.prepare(`
      UPDATE taches SET assigned_to = ?, date_echeance = ?
      WHERE id = ?
    `).run(agent_id, date_fin || null, notification.tache_id);
  }

  if (notification.opportunite_id) {
    db.prepare(`
      UPDATE opportunites SET owner_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(agent_id, notification.opportunite_id);
  }

  if (notification.contact_id) {
    db.prepare('UPDATE contacts SET owner_id = ? WHERE id = ?')
      .run(agent_id, notification.contact_id);
  }

  db.prepare('UPDATE notifications SET lu = 1 WHERE id = ?').run(id);

  const contact = db.prepare('SELECT nom FROM contacts WHERE id = ?')
    .get(notification.contact_id);

  db.prepare(`
    INSERT INTO notifications (type, titre, message, contact_id, opportunite_id,
      tache_id, destinataire_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'assignation',
    `Nouveau lead assigné : ${contact?.nom || 'Inconnu'}`,
    `Un lead vous a été assigné. Date limite : ${date_fin || 'Non définie'}`,
    notification.contact_id,
    notification.opportunite_id,
    notification.tache_id,
    agent_id
  );

  res.json({ success: true, message: `Lead assigné à ${agent.nom}` });
});

// ── PATCH /api/notifications/tout-lire ──────────────────────────────────────
router.patch('/tout-lire', (req, res) => {
  const userId = req.session.userId;
  const role   = req.session.role;

  if (role === 'commercial') {
    db.prepare('UPDATE notifications SET lu = 1 WHERE destinataire_id = ?').run(userId);
  } else {
    db.prepare('UPDATE notifications SET lu = 1').run();
  }
  res.json({ success: true });
});

// ── PATCH /api/notifications/:id/lire ───────────────────────────────────────
router.patch('/:id/lire', (req, res) => {
  db.prepare('UPDATE notifications SET lu = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;