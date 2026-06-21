// public/js/workflows.js
async function loadWorkflows() {
  await initSidebar('workflows');

  const [workflows, contacts, stats] = await Promise.all([
    api.get('/api/workflows'),
    api.get('/api/contacts'),
    api.get('/api/stats/workflows-par-statut')
  ]);

  document.getElementById('workflow-tbody').innerHTML = workflows.map(w => `
    <tr>
      <td>${w.titre}</td>
      <td>${w.contact_nom || '—'}</td>
      <td>${w.statut}</td>
      <td>${w.owner_nom || '—'}</td>
      <td>${formatDate(w.date_debut)}</td>
    </tr>
  `).join('');

  document.getElementById('workflow-contact').innerHTML = contacts.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
  document.getElementById('workflow-stats').innerHTML = stats.map(item => `
    <div class="stat-card">
      <div class="label">${item.statut}</div>
      <div class="value">${item.count}</div>
      <div class="sub">Workflows</div>
    </div>
  `).join('');
}

function openWorkflowModal() {
  document.getElementById('workflow-form').reset();
  document.getElementById('workflow-modal').classList.add('open');
}

function closeWorkflowModal() {
  document.getElementById('workflow-modal').classList.remove('open');
}

document.getElementById('workflow-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titre = document.getElementById('workflow-titre').value;
  const description = document.getElementById('workflow-description').value;
  const contact_id = document.getElementById('workflow-contact').value || null;
  const date_debut = document.getElementById('workflow-debut').value;
  const date_fin_prevue = document.getElementById('workflow-fin').value;
  const steps = document.getElementById('workflow-steps').value.split(';').map((step) => ({ titre: step.trim() })).filter(s => s.titre);

  try {
    await api.post('/api/workflows', { titre, description, contact_id, date_debut, date_fin_prevue, steps });
    closeWorkflowModal();
    await loadWorkflows();
  } catch (err) {
    alert(err.message);
  }
});

loadWorkflows();
