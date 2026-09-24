// public/js/workflows.js

let allUsers = [];
let allContacts = [];

async function loadWorkflows() {
  await initSidebar('workflows');

  // Charger utilisateurs et contacts pour les selects
  allUsers    = await api.get('/api/users');
  allContacts = await api.get('/api/contacts');

  // Peupler les selects du modal
  populateSelect('workflow-contact', allContacts, 'Aucun client');
  populateSelect('workflow-responsable', allUsers, 'Choisir un responsable');

  const workflows = await api.get('/api/workflows');
  renderStats(workflows);
  renderTable(workflows);
}

// ── Peupler un select ─────────────────────────────────────────────────────────
function populateSelect(id, items, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<option value="">— ${placeholder} —</option>` +
    items.map(i => `<option value="${i.id}">${i.nom}</option>`).join('');
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats(workflows) {
  const bloque   = workflows.filter(w => w.statut === 'bloque').length;
  const enCours  = workflows.filter(w => w.statut === 'en_cours').length;
  const termine  = workflows.filter(w => w.statut === 'termine').length;

  document.getElementById('workflow-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">BLOQUÉ</div><div class="stat-value">${bloque}</div><div class="stat-sub">Workflows</div></div>
    <div class="stat-card"><div class="stat-label">EN_COURS</div><div class="stat-value">${enCours}</div><div class="stat-sub">Workflows</div></div>
    <div class="stat-card"><div class="stat-label">TERMINÉ</div><div class="stat-value">${termine}</div><div class="stat-sub">Workflows</div></div>
  `;
}

// ── Tableau ───────────────────────────────────────────────────────────────────
function renderTable(workflows) {
  const tbody = document.getElementById('workflow-tbody');
  if (!workflows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">Aucun workflow</td></tr>';
    return;
  }
  tbody.innerHTML = workflows.map(w => {
    const progression = calculerProgression(w.steps || []);
    return `
      <tr style="cursor:pointer;" onclick="ouvrirDetailWorkflow(${w.id})">
        <td>
          <strong>${w.titre}</strong>
          <div style="font-size:12px;color:#888;margin-top:4px;">
            <div style="background:#e5e7eb;border-radius:4px;height:6px;width:120px;">
              <div style="background:#0b2545;height:6px;border-radius:4px;width:${progression}%;"></div>
            </div>
            <span>${progression}% complété</span>
          </div>
        </td>
        <td>${w.contact_nom || '—'}</td>
        <td>
          <select onchange="changerStatut(${w.id}, this.value)" onclick="event.stopPropagation()"
            style="padding:4px 8px;border-radius:6px;border:1px solid #ddd;font-size:13px;">
            <option value="en_cours"  ${w.statut === 'en_cours'  ? 'selected' : ''}>en_cours</option>
            <option value="bloque"    ${w.statut === 'bloque'    ? 'selected' : ''}>bloque</option>
            <option value="termine"   ${w.statut === 'termine'   ? 'selected' : ''}>termine</option>
          </select>
        </td>
        <td>${w.owner_nom || '—'}</td>
        <td>${w.date_debut ? new Date(w.date_debut).toLocaleDateString('fr-FR') : '—'}</td>
      </tr>
    `;
  }).join('');
}

// ── Progression ───────────────────────────────────────────────────────────────
function calculerProgression(steps) {
  if (!steps.length) return 0;
  const terminees = steps.filter(s => s.statut === 'termine').length;
  return Math.round((terminees / steps.length) * 100);
}

// ── Changer statut workflow ───────────────────────────────────────────────────
async function changerStatut(id, statut) {
  await api.put(`/api/workflows/${id}`, { statut });
  await loadWorkflows();
}

// ── Modal création ────────────────────────────────────────────────────────────
function openWorkflowModal() {
  document.getElementById('workflow-form').reset();
  document.getElementById('workflow-modal').classList.add('open');
}

function closeWorkflowModal() {
  document.getElementById('workflow-modal').classList.remove('open');
}

document.getElementById('workflow-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const titreSteps = document.getElementById('workflow-steps').value;
  const steps = titreSteps
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map((titre, index) => ({ titre, ordre: index + 1 }));

  const data = {
    titre:          document.getElementById('workflow-titre').value,
    description:    document.getElementById('workflow-description').value,
    contact_id:     document.getElementById('workflow-contact').value || null,
    owner_id:       document.getElementById('workflow-responsable').value || null,
    date_debut:     document.getElementById('workflow-debut').value || null,
    date_fin_prevue:document.getElementById('workflow-fin').value || null,
    steps
  };

  try {
    await api.post('/api/workflows', data);
    closeWorkflowModal();
    await loadWorkflows();
  } catch (err) {
    alert(err.message);
  }
});

// ── Modal détail workflow ─────────────────────────────────────────────────────
async function ouvrirDetailWorkflow(id) {
  const workflows = await api.get('/api/workflows');
  const w = workflows.find(x => x.id === id);
  if (!w) return;

  document.getElementById('detail-workflow-titre').textContent = w.titre;

  const steps = w.steps || [];
  const progression = calculerProgression(steps);

  let html = `
    <div style="margin-bottom:16px;">
      <span style="color:#888;font-size:13px;">Client : </span>
      <strong>${w.contact_nom || '—'}</strong>
      &nbsp;|&nbsp;
      <span style="color:#888;font-size:13px;">Responsable : </span>
      <strong>${w.owner_nom || '—'}</strong>
    </div>
    <div style="margin-bottom:16px;">
      <div style="background:#e5e7eb;border-radius:6px;height:8px;">
        <div style="background:#0b2545;height:8px;border-radius:6px;width:${progression}%;transition:width 0.3s;"></div>
      </div>
      <div style="font-size:12px;color:#888;margin-top:4px;">${progression}% complété</div>
    </div>
    <h3 style="margin-bottom:12px;">Étapes</h3>
  `;

  if (!steps.length) {
    html += '<p style="color:#888;">Aucune étape définie.</p>';
  } else {
    html += steps.map(step => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;">
        <div style="flex:1;">
          <strong>${step.titre}</strong>
          ${step.assigned_to ? `<div style="font-size:12px;color:#888;">Assigné à : ${allUsers.find(u => u.id === step.assigned_to)?.nom || '—'}</div>` : ''}
        </div>
        <select onchange="changerStatutStep(${step.id}, this.value, ${id})"
          style="padding:4px 8px;border-radius:6px;border:1px solid #ddd;font-size:12px;">
          <option value="a_faire" ${step.statut === 'a_faire' ? 'selected' : ''}>À faire</option>
          <option value="en_cours" ${step.statut === 'en_cours' ? 'selected' : ''}>En cours</option>
          <option value="termine" ${step.statut === 'termine' ? 'selected' : ''}>Terminée</option>
        </select>
      </div>
    `).join('');
  }

  // Ajouter une étape
  html += `
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
      <h4>Ajouter une étape</h4>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <input type="text" id="new-step-titre" placeholder="Titre de l'étape"
          style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;">
        <select id="new-step-responsable"
          style="padding:8px;border:1px solid #ddd;border-radius:6px;">
          <option value="">— Responsable —</option>
          ${allUsers.map(u => `<option value="${u.id}">${u.nom}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="ajouterStep(${id})">Ajouter</button>
      </div>
    </div>
  `;

  document.getElementById('detail-workflow-corps').innerHTML = html;
  document.getElementById('detail-workflow-modal').classList.add('open');
}

function fermerDetailWorkflow() {
  document.getElementById('detail-workflow-modal').classList.remove('open');
}

// ── Changer statut d'une étape ────────────────────────────────────────────────
async function changerStatutStep(stepId, statut, workflowId) {
  await api.put(`/api/workflows/steps/${stepId}`, { statut });
  await ouvrirDetailWorkflow(workflowId);
  await loadWorkflows();
}

// ── Ajouter une étape ─────────────────────────────────────────────────────────
async function ajouterStep(workflowId) {
  const titre = document.getElementById('new-step-titre').value.trim();
  if (!titre) return alert('Titre requis');

  const assigned_to = document.getElementById('new-step-responsable').value || null;

  await api.post(`/api/workflows/${workflowId}/steps`, {
    titre,
    assigned_to,
    ordre: 99
  });

  await ouvrirDetailWorkflow(workflowId);
  await loadWorkflows();
}

loadWorkflows();