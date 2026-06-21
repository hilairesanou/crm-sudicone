// server/middleware/auth.js
// Middlewares de protection des routes

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  const requestPath = req.originalUrl || req.url || req.path;
  if (requestPath.startsWith('/api/')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  return res.redirect('/login.html');
}

// Vérifie que l'utilisateur a un des rôles autorisés
function requireRole(...rolesAutorises) {
  return (req, res, next) => {
    if (!req.session || !req.session.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!rolesAutorises.includes(req.session.role)) {
      return res.status(403).json({ error: 'Accès refusé : permissions insuffisantes' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
