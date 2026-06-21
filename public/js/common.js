// public/js/common.js
// Fonctions partagées par toutes les pages : appels API, sidebar, utilitaires

const api = {
  async get(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
    return res.json();
  }
};

function formatMontant(montant, devise = 'XOF') {
  const n = Number(montant) || 0;
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' ' + devise;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function linearRegression(series) {
  const n = series.length;
  if (n < 2) return { slope: 0, intercept: series[n - 1] || 0 };
  const x = series.map((_, index) => index + 1);
  const y = series;
  const sumX = x.reduce((sum, value) => sum + value, 0);
  const sumY = y.reduce((sum, value) => sum + value, 0);
  const sumXY = x.reduce((sum, value, index) => sum + value * y[index], 0);
  const sumXX = x.reduce((sum, value) => sum + value * value, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function predictNextValue(series) {
  const { slope, intercept } = linearRegression(series);
  return Math.max(0, intercept + slope * (series.length + 1));
}

function formatPercent(value) {
  const n = Number(value) || 0;
  return `${n.toFixed(1).replace('.', ',')} %`;
}

function badge(value, label) {
  return `<span class="badge badge-${value}">${label || value}</span>`;
}

// Construit la sidebar et charge l'utilisateur connecté
async function initSidebar(activePage) {
  const sidebarHtml = `
    <div class="sidebar">
      <div class="sidebar-logo">
        SUDICONE
        <span>CRM Interne</span>
      </div>
      <nav class="sidebar-nav">
        <a href="/dashboard" class="${activePage === 'dashboard' ? 'active' : ''}"><i class="bi bi-bar-chart-fill"></i> <span class="label">Tableau de bord</span></a>
        <a href="/contacts" class="${activePage === 'contacts' ? 'active' : ''}"><i class="bi bi-person-fill"></i> <span class="label">Contacts</span></a>
        <a href="/pipeline" class="${activePage === 'pipeline' ? 'active' : ''}"><i class="bi bi-graph-up"></i> <span class="label">Pipeline</span></a>
        <a href="/services" class="${activePage === 'services' ? 'active' : ''}"><i class="bi bi-hdd-network"></i> <span class="label">Services</span></a>
        <a href="/workflows" class="${activePage === 'workflows' ? 'active' : ''}"><i class="bi bi-arrow-right-square"></i> <span class="label">Workflows</span></a>
        <a href="/organigramme" class="${activePage === 'organigramme' ? 'active' : ''}"><i class="bi bi-diagram-3"></i> <span class="label">Organigramme</span></a>
        <a href="/factures" class="${activePage === 'factures' ? 'active' : ''}"><i class="bi bi-file-earmark-text-fill"></i> <span class="label">Factures / Devis</span></a>
        <a href="/taches" class="${activePage === 'taches' ? 'active' : ''}"><i class="bi bi-check2-square"></i> <span class="label">Tâches</span></a>
        <a href="/utilisateurs" class="${activePage === 'utilisateurs' ? 'active' : ''}" id="nav-users" style="display:none"><i class="bi bi-gear-fill"></i> <span class="label">Utilisateurs</span></a>
      </nav>
      <div class="sidebar-footer" id="sidebar-footer"></div>
    </div>
  `;
  document.getElementById('sidebar-mount').outerHTML = sidebarHtml;

  try {
    const user = await api.get('/api/auth/me');
    document.getElementById('sidebar-footer').innerHTML = `
      <div class="user-nom">${user.nom}</div>
      <div class="user-role">${user.role}</div>
      <button onclick="logout()">Déconnexion</button>
    `;
    if (user.role === 'admin' || user.role === 'manager') {
      document.getElementById('nav-users').style.display = 'flex';
    }
    return user;
  } catch (e) {
    window.location.href = '/login.html';
  }
}

async function logout() {
  await api.post('/api/auth/logout', {});
  window.location.href = '/login.html';
}

// Couleurs cohérentes pour les graphiques
const CHART_COLORS = {
  bleu: '#0b2545', bleuFonce: '#071422', vert: '#16a34a', rouge: '#dc2626',
  orange: '#ea580c', violet: '#7c3aed', jaune: '#eab308', gris: '#6b7280', cyan: '#0891b2'
};
const CHART_PALETTE = [CHART_COLORS.bleu, CHART_COLORS.vert, CHART_COLORS.orange, CHART_COLORS.violet, CHART_COLORS.rouge, CHART_COLORS.cyan, CHART_COLORS.jaune, CHART_COLORS.gris];
