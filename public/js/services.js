// public/js/services.js
async function loadServices() {
  await initSidebar('services');

  const [services, packs, contacts, stats] = await Promise.all([
    api.get('/api/services'),
    api.get('/api/services/packs'),
    api.get('/api/contacts'),
    api.get('/api/stats/services-par-categorie')
  ]);

  document.getElementById('services-tbody').innerHTML = services.map(s => `
    <tr>
      <td>${s.code}</td>
      <td>${s.titre}</td>
      <td>${s.categorie}</td>
      <td>${formatMontant(s.prix_ht, 'XOF')}</td>
      <td>${s.duree_mois} mois</td>
    </tr>
  `).join('');

  document.getElementById('packs-tbody').innerHTML = packs.map(p => `
    <tr>
      <td>${p.nom}</td>
      <td>${p.description || '—'}</td>
      <td>${formatMontant(p.prix_ht, 'XOF')}</td>
      <td>${p.duree_mois} mois</td>
      <td>${p.services.map(s => s.titre).join(', ')}</td>
    </tr>
  `).join('');

  document.getElementById('service-contact').innerHTML = contacts.map(c => `<option value="${c.id}">${c.nom} (${c.entreprise || 'sans entreprise'})</option>`).join('');
  document.getElementById('service-select').innerHTML = services.map(s => `<option value="${s.id}">${s.titre} — ${formatMontant(s.prix_ht, 'XOF')}</option>`).join('');
  document.getElementById('pack-select').innerHTML = packs.map(p => `<option value="${p.id}">${p.nom} — ${formatMontant(p.prix_ht, 'XOF')}</option>`).join('');

  document.getElementById('services-grid').innerHTML = stats.map(item => `
    <div class="stat-card">
      <div class="label">${item.categorie}</div>
      <div class="value">${item.count}</div>
      <div class="sub">Total HT ${formatMontant(item.montant, 'XOF')}</div>
    </div>
  `).join('');
}

function closeAssignModal() {
  document.getElementById('assign-modal').classList.remove('open');
}

document.getElementById('assign-type').addEventListener('change', (e) => {
  const isPack = e.target.value === 'pack';
  document.getElementById('pack-select-group').style.display = isPack ? 'block' : 'none';
  document.getElementById('service-select-group').style.display = isPack ? 'none' : 'block';
  document.getElementById('renew-group').style.display = isPack ? 'none' : 'block';
});

document.getElementById('assign-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contact_id = document.getElementById('service-contact').value;
  if (!contact_id) return alert('Choisir un client');

  const type = document.getElementById('assign-type').value;
  const date_debut = document.getElementById('date-debut').value;
  const date_fin = document.getElementById('date-fin').value;
  const tarif_ht = parseFloat(document.getElementById('tarif-ht').value) || 0;

  try {
    if (type === 'service') {
      const service_id = document.getElementById('service-select').value;
      await api.post('/api/services/assign-service', { contact_id, service_id, date_debut, date_fin, tarif_ht, renouvellement_auto: document.getElementById('renew-auto').value });
    } else {
      const pack_id = document.getElementById('pack-select').value;
      await api.post('/api/services/assign-pack', { contact_id, pack_id, date_debut, date_fin, tarif_ht });
    }
    closeAssignModal();
    await loadServices();
  } catch (err) {
    alert(err.message);
  }
});

loadServices();
