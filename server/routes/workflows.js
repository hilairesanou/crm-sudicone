// public/js/workflows.js
let workflowsData = [];
let contactsData  = [];

async function loadWorkflows() {
  await initSidebar('workflows');

  const [workflows, contacts] = await Promise.all([
    api.get('/api/workflows'),
    api.get('/api/contacts')
  ]);

  workflowsData = workflows;
  contactsData  = contacts;

  // ── Stats ─────────────────────────────────────────────────────────
  const stats = {
    total:      workflows.length,
    en_cours:   workflows.filter(w => w.statut === 'en_cours').length,
    termine:    workflows.filter(w => w.statut === 'termine').length,
    bloque:     workflows.filter(w => w.statut === 'bloque').length,
  };

  document.getElementById('workflow-stats').innerHTML = `
    <div class="stat-card">
      <div class="label">Total workflows</div>
      <div class="value">${stats.total}</div>
      <div class="sub">Tous statuts confondus</div>
    </div>
    <div class="stat-card">
      <div class="label">En cours</div>
      <div class="value">${stats.en_cours}</div>
      <div class="sub">Workflows actifs</div>
    </div>
    <div class="stat-card">
      <div class="label">Terminés</div>
      <div class="value">${stats.termine}</div>
      <div class="sub">Workflows clôturés</div>
    </div>
    <div class="stat-card">
      <div class="label">Bloqués</div>
      <div class="value">${stats.bloque}</div>
      <div class="sub" style="color:#dc2626;">Nécessitent attention</div>
    </div>
  `;

  // ── Tableau ───────────────────────────────────────────────────────
  const statutClass = {
    en_cours: 'badge-prospect',
    termine:  'badge-client',
    bloque:   'badge-en_retard'
  };
  const statutLabel = {
    en_cours: 'En cours',
    termine:  'Terminé',
    bloque:   'Bloqué'
  };

  document.getElementById('workflow-tbody').innerHTML = workflows.map(w => `
    <tr onclick="ouvrirDetailWorkflow(${w.id})" style="cursor:pointer;"
        onmouseover="this.style.background='var(--gris-clair)'"
        onmouseout="this.style.background=''">
      <td>
        <div style="font-weight:600; color:var(--bleu);">${w.titre}</div>
        <div style="font-size:0.75rem; color:var(--gris);">${w.steps?.length || 0} étape(s)</div>
      </td>
      <td>${w.contact_nom || '—'}</td>
      <td><span class="badge ${statutClass[w.statut] || ''}">${statutLabel[w.statut] || w.statut}</span></td>
      <td>${w.owner_nom || '—'}</td>
      <td>${formatDate(w.date_debut)}</td>
    </tr>
  `).join('');

  // ── Select contacts dans modal création ───────────────────────────
  document.getElementById('workflow-contact').innerHTML =
    '<option value="">— Aucun —</option>' +
    contacts.map(c => `<option value="${c.id}">${c.nom}${c.entreprise ? ' — ' + c.entreprise : ''}</option>`).join('');
}

// ── Modal détail workflow ─────────────────────────────────────────────────────
function ouvrirDetailWorkflow(id) {
  const w = workflowsData.find(x => x.id === id);
  if (!w) return;

  const statutLabel = { en_cours: 'En cours', termine: 'Terminé', bloque: 'Bloqué' };
  const statutColor = { en_cours: '#1b3a6b', termine: '#16a34a', bloque: '#dc2626' };
  const stepStatutLabel = { a_faire: 'À faire', en_cours: 'En cours', terminee: 'Terminée' };
  const stepStatutColor = { a_faire: '#6b7280', en_cours: '#1b3a6b', terminee: '#16a34a' };

  const stepsTerminees = w.steps?.filter(s => s.statut === 'terminee').length || 0;
  const totalSteps     = w.steps?.length || 0;
  const progression    = totalSteps > 0 ? Math.round((stepsTerminees / totalSteps) * 100) : 0;

  document.getElementById('detail-workflow-titre').textContent = w.titre;
  document.getElementById('detail-workflow-corps').innerHTML = `
    <!-- Infos générales -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Statut</div>
        <span class="badge" style="background:${statutColor[w.statut]}20; color:${statutColor[w.statut]}; font-size:0.82rem;">
          ${statutLabel[w.statut] || w.statut}
        </span>
      </div>
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Client</div>
        <div style="font-weight:600; color:var(--bleu); font-size:0.88rem;">${w.contact_nom || '—'}</div>
      </div>
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Date début</div>
        <div style="font-weight:600; color:var(--bleu); font-size:0.88rem;">${formatDate(w.date_debut)}</div>
      </div>
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Date prévue</div>
        <div style="font-weight:600; color:var(--bleu); font-size:0.88rem;">${formatDate(w.date_fin_prevue)}</div>
      </div>
    </div>

    ${w.description ? `
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px; margin-bottom:16px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Description</div>
        <div style="font-size:0.88rem; color:var(--gris-fonce); line-height:1.6;">${w.description}</div>
      </div>
    ` : ''}

    <!-- Progression -->
    <div style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="font-size:0.78rem; font-weight:700; color:var(--bleu); text-transform:uppercase; letter-spacing:0.5px;">
          Progression
        </div>
        <div style="font-size:0.82rem; font-weight:700; color:var(--bleu);">
          ${stepsTerminees} / ${totalSteps} étapes — ${progression}%
        </div>
      </div>
      <div style="background:#e5e7eb; border-radius:999px; height:8px; overflow:hidden;">
        <div style="
          height:100%; border-radius:999px;
          width:${progression}%;
          background:${progression === 100 ? '#16a34a' : progression >= 50 ? '#1b3a6b' : '#f59e0b'};
          transition: width 0.5s ease;
        "></div>
      </div>
    </div>

    <!-- Étapes -->
    ${totalSteps > 0 ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:0.78rem; font-weight:700; color:var(--bleu); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">
          Étapes du workflow
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${w.steps.map((s, i) => `
            <div style="
              display:flex; align-items:center; gap:12px;
              background:${s.statut === 'terminee' ? '#f0fdf4' : 'var(--gris-clair)'};
              border-radius:8px; padding:10px 14px;
              border-left:3px solid ${stepStatutColor[s.statut] || '#6b7280'};
            ">
              <div style="
                width:24px; height:24px; border-radius:50%; flex-shrink:0;
                background:${stepStatutColor[s.statut] || '#6b7280'};
                color:white; display:flex; align-items:center; justify-content:center;
                font-size:0.72rem; font-weight:700;
              ">${i + 1}</div>
              <div style="flex:1;">
                <div style="
                  font-weight:600; font-size:0.85rem;
                  color:${s.statut === 'terminee' ? '#16a34a' : 'var(--bleu)'};
                  text-decoration:${s.statut === 'terminee' ? 'line-through' : 'none'};
                ">${s.titre}</div>
                ${s.description ? `<div style="font-size:0.75rem; color:var(--gris);">${s.description}</div>` : ''}
              </div>
              <span style="
                padding:2px 8px; border-radius:999px; font-size:0.7rem; font-weight:600;
                background:${stepStatutColor[s.statut] || '#6b7280'}20;
                color:${stepStatutColor[s.statut] || '#6b7280'};
                white-space:nowrap; flex-shrink:0;
              ">${stepStatutLabel[s.statut] || s.statut}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `
      <div style="text-align:center; padding:20px; color:var(--gris); font-size:0.85rem;">
        <i class="bi bi-diagram-2" style="font-size:2rem; display:block; margin-bottom:8px; opacity:0.4;"></i>
        Aucune étape définie
      </div>
    `}

    <!-- Actions -->
    <div style="display:flex; gap:10px; margin-top:8px;">
      <select onchange="changerStatutWorkflow(${w.id}, this.value)" style="
        flex:1; padding:8px 12px; border:1.5px solid var(--bordure);
        border-radius:8px; font-size:0.85rem; background:var(--blanc);
      ">
        <option value="en_cours" ${w.statut === 'en_cours' ? 'selected' : ''}>En cours</option>
        <option value="termine"  ${w.statut === 'termine'  ? 'selected' : ''}>Terminé</option>
        <option value="bloque"   ${w.statut === 'bloque'   ? 'selected' : ''}>Bloqué</option>
      </select>
      <button class="btn btn-danger" onclick="supprimerWorkflow(${w.id})">
        <i class="bi bi-trash"></i> Supprimer
      </button>
    </div>
  `;

  document.getElementById('detail-workflow-modal').classList.add('open');
}

function fermerDetailWorkflow() {
  document.getElementById('detail-workflow-modal').classList.remove('open');
}

async function changerStatutWorkflow(id, statut) {
  await api.put('/api/workflows/' + id, { statut });
  fermerDetailWorkflow();
  await loadWorkflows();
}

async function supprimerWorkflow(id) {
  if (!confirm('Supprimer ce workflow ? Cette action est irréversible.')) return;
  await api.delete('/api/workflows/' + id);
  fermerDetailWorkflow();
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
  const titre       = document.getElementById('workflow-titre').value;
  const contact_id  = document.getElementById('workflow-contact').value || null;
  const description = document.getElementById('workflow-description').value;
  const date_debut  = document.getElementById('workflow-debut').value;
  const date_fin    = document.getElementById('workflow-fin').value;
  const stepsRaw    = document.getElementById('workflow-steps').value;

  const steps = stepsRaw
    ? stepsRaw.split(';').map(s => s.trim()).filter(Boolean).map((s, i) => ({ titre: s, ordre: i + 1 }))
    : [];

  try {
    await api.post('/api/workflows', {
      titre, contact_id, description,
      date_debut: date_debut || null,
      date_fin_prevue: date_fin || null,
      steps
    });
    closeWorkflowModal();
    await loadWorkflows();
  } catch (err) {
    alert(err.message);
  }
});

loadWorkflows();