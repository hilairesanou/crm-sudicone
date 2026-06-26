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
  },
  async patch(url, data = {}) {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
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

// ── Panneau notifications ────────────────────────────────────────────────────
let notifPanneauOuvert = false;
let notifData = [];
let currentUserRole = null;

function toggleNotifPanneau() {
  notifPanneauOuvert = !notifPanneauOuvert;
  const panneau = document.getElementById('notif-panneau');
  panneau.style.display = notifPanneauOuvert ? 'block' : 'none';
  if (notifPanneauOuvert) chargerNotifications();
}

function fermerNotifPanneau() {
  notifPanneauOuvert = false;
  const panneau = document.getElementById('notif-panneau');
  if (panneau) panneau.style.display = 'none';
}

async function chargerNotifications() {
  try {
    const data = await api.get('/api/notifications');
    notifData = data.notifications || [];

    const badgeEl = document.getElementById('notif-badge');
    if (!badgeEl) return;

    if (data.non_lues > 0) {
      badgeEl.textContent = data.non_lues;
      badgeEl.style.display = 'flex';
    } else {
      badgeEl.style.display = 'none';
    }

    const liste = document.getElementById('notif-liste');
    if (!liste) return;

    if (!notifData.length) {
      liste.innerHTML = `
        <div style="text-align:center; color:#9ca3af; padding:32px 16px; font-size:0.9rem;">
          <i class="bi bi-bell-slash" style="font-size:2rem; display:block; margin-bottom:8px;"></i>
          Aucune notification
        </div>`;
      return;
    }

    liste.innerHTML = notifData.map(n => `
      <div style="
        padding:12px 16px; border-bottom:1px solid #f3f4f6;
        background:${n.lu ? '#fff' : '#fffbeb'};
        cursor:pointer;
      " onclick="ouvrirNotif(${n.id})">
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <div style="
            width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:6px;
            background:${n.lu ? '#d1d5db' : '#f59e0b'};
          "></div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:0.85rem;">${n.titre}</div>
            <div style="color:#6b7280; font-size:0.78rem; margin-top:2px;
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${n.message}
            </div>
            <div style="color:#9ca3af; font-size:0.72rem; margin-top:4px;">
              ${formatDate(n.created_at)}
              ${n.contact_nom ? ' · ' + n.contact_nom : ''}
            </div>
          </div>
          ${n.type === 'lead_public' && !n.lu ? `
            <span style="
              padding:2px 8px; border-radius:999px; font-size:0.7rem;
              background:#fef3c7; color:#d97706; font-weight:600; flex-shrink:0;
            ">Nouveau lead</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Erreur notifications:', e);
  }
}

async function ouvrirNotif(id) {
  const notif = notifData.find(n => n.id === id);
  if (!notif) return;

  if (!notif.lu) {
    await api.patch(`/api/notifications/${id}/lire`);
    notif.lu = 1;
    chargerNotifications();
  }

  // Seul l'admin peut assigner un lead
  if (notif.type === 'lead_public' && currentUserRole === 'admin') {
    ouvrirModalAssignation(notif);
  } else if (notif.contact_id) {
    window.location.href = '/contacts';
  }
}

async function ouvrirModalAssignation(notif) {
  const agents = await api.get('/api/notifications/agents');
  const couleurDispo = { 'disponible': '#22c55e', 'chargé': '#f59e0b', 'surchargé': '#ef4444' };

  const modal = document.getElementById('notif-modal');
  document.getElementById('notif-modal-content').innerHTML = `
    <h3 style="margin:0 0 4px; font-size:1.1rem;">Assigner ce lead</h3>
    <p style="color:#6b7280; font-size:0.85rem; margin:0 0 20px;">
      ${notif.titre} — ${notif.message}
    </p>

    <div style="margin-bottom:16px;">
      <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:6px;">
        Choisir un agent
      </label>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${agents.map(a => `
          <label style="
            display:flex; align-items:center; gap:12px;
            border:1px solid #e5e7eb; border-radius:8px; padding:10px 14px;
            cursor:pointer;
          ">
            <input type="radio" name="agent_id" value="${a.id}" style="accent-color:#1b3a6b;">
            <div style="flex:1;">
              <div style="font-weight:600; font-size:0.88rem;">${a.nom}</div>
              <div style="color:#6b7280; font-size:0.78rem;">
                ${a.role} · ${a.taches_actives} tâche(s) active(s)
              </div>
            </div>
            <span style="
              padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:600;
              background:${couleurDispo[a.disponibilite] || '#6b7280'}20;
              color:${couleurDispo[a.disponibilite] || '#6b7280'};
            ">${a.disponibilite}</span>
          </label>
        `).join('')}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
      <div>
        <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:6px;">
          Date de début
        </label>
        <input type="date" id="assign-date-debut" style="
          width:100%; padding:8px 10px; border:1px solid #e5e7eb;
          border-radius:8px; font-size:0.85rem;
        " value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div>
        <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:6px;">
          Date limite
        </label>
        <input type="date" id="assign-date-fin" style="
          width:100%; padding:8px 10px; border:1px solid #e5e7eb;
          border-radius:8px; font-size:0.85rem;
        ">
      </div>
    </div>

    <div style="display:flex; gap:10px; justify-content:flex-end;">
      <button onclick="fermerModalNotif()" style="
        padding:8px 20px; border:1px solid #e5e7eb; border-radius:8px;
        background:#fff; cursor:pointer; font-size:0.85rem; color:#6b7280;
      ">Annuler</button>
      <button onclick="confirmerAssignation(${notif.id})" style="
        padding:8px 20px; border:none; border-radius:8px;
        background:#1b3a6b; color:#fff; cursor:pointer; font-size:0.85rem; font-weight:600;
      ">Assigner</button>
    </div>
  `;
  modal.style.display = 'flex';
}

function fermerModalNotif() {
  document.getElementById('notif-modal').style.display = 'none';
}

async function confirmerAssignation(notifId) {
  const agentInput = document.querySelector('input[name="agent_id"]:checked');
  if (!agentInput) {
    alert('Veuillez sélectionner un agent.');
    return;
  }

  const agent_id   = parseInt(agentInput.value);
  const date_debut = document.getElementById('assign-date-debut').value;
  const date_fin   = document.getElementById('assign-date-fin').value;

  try {
    const result = await api.post(`/api/notifications/${notifId}/assigner`, {
      agent_id, date_debut, date_fin
    });
    fermerModalNotif();
    fermerNotifPanneau();
    chargerNotifications();

    const toast = document.createElement('div');
    toast.textContent = result.message || 'Lead assigné avec succès !';
    toast.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      background:#22c55e; color:#fff; padding:12px 20px;
      border-radius:8px; font-size:0.88rem; font-weight:600;
      box-shadow:0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  } catch (e) {
    alert('Erreur : ' + e.message);
  }
}

async function toutMarquerLu() {
  await api.patch('/api/notifications/tout-lire');
  chargerNotifications();
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
async function initSidebar(activePage) {

  // Cloche et modals — injectés pour tout le monde, cachés selon le rôle
  const notifHtml = `
    <!-- Cloche notifications -->
    <div id="notif-cloche" style="position:fixed; top:16px; right:24px; z-index:1000; display:none;">
      <button onclick="toggleNotifPanneau()" style="
        position:relative; background:#fff; border:1px solid #e5e7eb;
        border-radius:50%; width:42px; height:42px;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.08);
      ">
        <span style="font-size:1.1rem;">🔔</span>
        <span id="notif-badge" style="
          position:absolute; top:-4px; right:-4px;
          background:#ef4444; color:#fff; border-radius:999px;
          width:18px; height:18px; font-size:0.65rem; font-weight:700;
          display:none; align-items:center; justify-content:center;
        "></span>
      </button>
    </div>

    <!-- Panneau notifications -->
    <div id="notif-panneau" style="
      display:none; position:fixed; top:68px; right:24px; z-index:999;
      width:380px; max-height:520px; background:#fff;
      border:1px solid #e5e7eb; border-radius:12px;
      box-shadow:0 8px 24px rgba(0,0,0,0.12); overflow:hidden;
      flex-direction:column;
    ">
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:14px 16px; border-bottom:1px solid #f3f4f6; background:#f9fafb;
      ">
        <span style="font-weight:700; font-size:0.95rem;">
          <i class="bi bi-bell-fill" style="color:#f59e0b; margin-right:6px;"></i>
          Notifications
        </span>
        <div style="display:flex; gap:8px; align-items:center;">
          <button onclick="toutMarquerLu()" style="
            background:none; border:none; color:#3b82f6;
            cursor:pointer; font-size:0.78rem;
          ">Tout marquer lu</button>
          <button onclick="fermerNotifPanneau()" style="
            background:none; border:none; color:#9ca3af;
            cursor:pointer; font-size:1rem;
          "><i class="bi bi-x-lg"></i></button>
        </div>
      </div>
      <div id="notif-liste" style="overflow-y:auto; max-height:440px;"></div>
    </div>

    <!-- Modal assignation (admin uniquement) -->
    <div id="notif-modal" style="
      display:none; position:fixed; inset:0; z-index:1100;
      background:rgba(0,0,0,0.4); align-items:center; justify-content:center;
    ">
      <div style="
        background:#fff; border-radius:12px; padding:24px;
        width:100%; max-width:500px; max-height:90vh; overflow-y:auto;
        margin:16px;
      ">
        <div id="notif-modal-content"></div>
      </div>
    </div>
  `;

  const sidebarHtml = `
    <div class="sidebar">
      <div class="sidebar-logo">
        SUDICONE
        <span>CRM Interne</span>
      </div>
      <nav class="sidebar-nav">
        <a href="/dashboard" class="${activePage === 'dashboard' ? 'active' : ''}">
          <i class="bi bi-bar-chart-fill"></i> <span class="label">Tableau de bord</span>
        </a>
        <a href="/contacts" class="${activePage === 'contacts' ? 'active' : ''}">
          <i class="bi bi-person-fill"></i> <span class="label">Contacts</span>
        </a>
        <a href="/pipeline" class="${activePage === 'pipeline' ? 'active' : ''}">
          <i class="bi bi-graph-up"></i> <span class="label">Pipeline</span>
        </a>
        <a href="/services" class="${activePage === 'services' ? 'active' : ''}">
          <i class="bi bi-hdd-network"></i> <span class="label">Services</span>
        </a>
        <a href="/workflows" class="${activePage === 'workflows' ? 'active' : ''}">
          <i class="bi bi-arrow-right-square"></i> <span class="label">Workflows</span>
        </a>
        <a href="/organigramme" class="${activePage === 'organigramme' ? 'active' : ''}">
          <i class="bi bi-diagram-3"></i> <span class="label">Organigramme</span>
        </a>
        <a href="/factures" class="${activePage === 'factures' ? 'active' : ''}">
          <i class="bi bi-file-earmark-text-fill"></i> <span class="label">Factures / Devis</span>
        </a>
        <a href="/taches" class="${activePage === 'taches' ? 'active' : ''}">
          <i class="bi bi-check2-square"></i> <span class="label">Tâches</span>
        </a>
        
          const params = new URLSearchParams(window.location.search);
          if (params.get('acces') === 'refuse') {
            const errorBox = document.getElementById('dashboard-error');
            errorBox.textContent = 'Accès refusé — Le module Analytique est réservé aux managers et administrateurs.';
            errorBox.style.display = 'block';
            // Effacer le paramètre de l'URL
            window.history.replaceState({}, '', '/dashboard');
          }

        <a href="/utilisateurs" class="${activePage === 'utilisateurs' ? 'active' : ''}"
           id="nav-users" style="display:none">
          <i class="bi bi-gear-fill"></i> <span class="label">Utilisateurs</span>
        </a>
      </nav>
      <div class="sidebar-footer" id="sidebar-footer"></div>
    </div>
    ${notifHtml}
  `;

  document.getElementById('sidebar-mount').outerHTML = sidebarHtml;

  try {
    const user = await api.get('/api/auth/me');
    currentUserRole = user.role;

    document.getElementById('sidebar-footer').innerHTML = `
      <div class="user-nom">${user.nom}</div>
      <div class="user-role">${user.role}</div>
      <button onclick="logout()">Déconnexion</button>
    `;

    // Menu utilisateurs visible pour admin et manager
    if (user.role === 'admin' || user.role === 'manager') {
      document.getElementById('nav-users').style.display = 'flex';
    }
    if (user.role === 'admin' || user.role === 'manager') {
      document.getElementById('nav-analytique').style.display = 'flex';
    }

    // Cloche visible uniquement pour l'admin
    if (user.role === 'admin') {
      document.getElementById('notif-cloche').style.display = 'flex';
      chargerNotifications();
      setInterval(chargerNotifications, 30000);
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
const CHART_PALETTE = [
  CHART_COLORS.bleu, CHART_COLORS.vert, CHART_COLORS.orange, CHART_COLORS.violet,
  CHART_COLORS.rouge, CHART_COLORS.cyan, CHART_COLORS.jaune, CHART_COLORS.gris
];