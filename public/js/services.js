// public/js/services.js
let servicesData = [];
let packsData    = [];

async function loadServices() {
  await initSidebar('services');

  const [services, packs, contacts, stats] = await Promise.all([
    api.get('/api/services'),
    api.get('/api/services/packs'),
    api.get('/api/contacts'),
    api.get('/api/stats/services-par-categorie')
  ]);

  servicesData = services;
  packsData    = packs;

  // ── Tableau services ──────────────────────────────────────────────
  document.getElementById('services-tbody').innerHTML = services.map(s => `
    <tr onclick="ouvrirDetailService(${s.id})" style="cursor:pointer;"
        onmouseover="this.style.background='var(--gris-clair)'"
        onmouseout="this.style.background=''">
      <td><strong>${s.code}</strong></td>
      <td>
        <div style="font-weight:600; color:var(--bleu);">${s.titre}</div>
        <div style="font-size:0.75rem; color:var(--gris);">${s.description || ''}</div>
      </td>
      <td><span class="badge badge-prospect">${s.categorie}</span></td>
      <td><strong>${formatMontant(s.prix_ht)}</strong></td>
      <td>${s.duree_mois} mois</td>
    </tr>
  `).join('');

  // ── Tableau packs ─────────────────────────────────────────────────
  document.getElementById('packs-tbody').innerHTML = packs.map(p => `
    <tr onclick="ouvrirDetailPack(${p.id})" style="cursor:pointer;"
        onmouseover="this.style.background='var(--gris-clair)'"
        onmouseout="this.style.background=''">
      <td><strong style="color:var(--bleu);">${p.nom}</strong></td>
      <td style="font-size:0.85rem; color:var(--gris);">${p.description || '—'}</td>
      <td><strong>${formatMontant(p.prix_ht)}</strong></td>
      <td>${p.duree_mois} mois</td>
      <td>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${p.services.map(s => `<span class="badge badge-client" style="font-size:0.7rem;">${s.titre}</span>`).join('')}
        </div>
      </td>
    </tr>
  `).join('');

  // ── Sélects du modal assignation ──────────────────────────────────
  document.getElementById('service-contact').innerHTML =
    contacts.map(c => `<option value="${c.id}">${c.nom}${c.entreprise ? ' — ' + c.entreprise : ''}</option>`).join('');
  document.getElementById('service-select').innerHTML =
    services.map(s => `<option value="${s.id}">${s.titre} — ${formatMontant(s.prix_ht)}</option>`).join('');
  document.getElementById('pack-select').innerHTML =
    packs.map(p => `<option value="${p.id}">${p.nom} — ${formatMontant(p.prix_ht)}</option>`).join('');

  // ── Stats par catégorie ───────────────────────────────────────────
  document.getElementById('services-grid').innerHTML = stats.map(item => `
    <div class="stat-card">
      <div class="label">${item.categorie || 'Non classé'}</div>
      <div class="value">${item.count}</div>
      <div class="sub">Total HT ${formatMontant(item.montant)}</div>
    </div>
  `).join('');
}

// ── Modal détail service ──────────────────────────────────────────────────────
function ouvrirDetailService(id) {
  const s = servicesData.find(x => x.id === id);
  if (!s) return;

  document.getElementById('detail-titre').textContent  = s.titre;
  document.getElementById('detail-corps').innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Code</div>
        <div style="font-weight:700; color:var(--bleu);">${s.code}</div>
      </div>
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Catégorie</div>
        <div style="font-weight:700; color:var(--bleu);">${s.categorie}</div>
      </div>
      <div style="background:var(--bleu); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:rgba(255,255,255,0.7); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Prix HT</div>
        <div style="font-weight:800; color:var(--or-clair); font-size:1.2rem;">${formatMontant(s.prix_ht)}</div>
      </div>
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Durée</div>
        <div style="font-weight:700; color:var(--bleu);">${s.duree_mois} mois</div>
      </div>
    </div>
    ${s.description ? `
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px; margin-bottom:16px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Description</div>
        <div style="font-size:0.88rem; color:var(--gris-fonce); line-height:1.6;">${s.description}</div>
      </div>
    ` : ''}
    <button class="btn btn-primary" style="width:100%;"
      onclick="
        fermerDetailModal();
        document.getElementById('assign-type').value = 'service';
        document.getElementById('service-select').value = '${s.id}';
        document.getElementById('tarif-ht').value = '${s.prix_ht}';
        document.getElementById('pack-select-group').style.display = 'none';
        document.getElementById('service-select-group').style.display = 'block';
        document.getElementById('assign-modal').classList.add('open');
      ">
      <i class="bi bi-plus-circle"></i> Assigner ce service à un client
    </button>
  `;

  document.getElementById('detail-modal').classList.add('open');
}

// ── Modal détail pack ─────────────────────────────────────────────────────────
function ouvrirDetailPack(id) {
  const p = packsData.find(x => x.id === id);
  if (!p) return;

  document.getElementById('detail-titre').textContent = p.nom;
  document.getElementById('detail-corps').innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
      <div style="background:var(--bleu); border-radius:10px; padding:14px; grid-column:span 2;">
        <div style="font-size:0.72rem; color:rgba(255,255,255,0.7); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Prix HT</div>
        <div style="font-weight:800; color:var(--or-clair); font-size:1.4rem;">${formatMontant(p.prix_ht)}</div>
      </div>
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Durée</div>
        <div style="font-weight:700; color:var(--bleu);">${p.duree_mois} mois</div>
      </div>
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Services inclus</div>
        <div style="font-weight:700; color:var(--bleu);">${p.services?.length || 0} services</div>
      </div>
    </div>

    ${p.description ? `
      <div style="background:var(--gris-clair); border-radius:10px; padding:14px; margin-bottom:16px;">
        <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Description</div>
        <div style="font-size:0.88rem; color:var(--gris-fonce); line-height:1.6;">${p.description}</div>
      </div>
    ` : ''}

    <div style="margin-bottom:16px;">
      <div style="font-size:0.72rem; color:var(--gris); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; font-weight:700;">
        Services inclus dans ce pack
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${p.services?.map(s => `
          <div style="display:flex; align-items:center; gap:12px; background:var(--gris-clair); border-radius:8px; padding:10px 14px;">
            <i class="bi bi-check-circle-fill" style="color:#16a34a;"></i>
            <div style="flex:1;">
              <div style="font-weight:600; font-size:0.85rem;">${s.titre}</div>
              <div style="font-size:0.75rem; color:var(--gris);">${s.categorie}</div>
            </div>
            <div style="font-weight:700; font-size:0.82rem; color:var(--bleu);">${formatMontant(s.prix_ht)}</div>
          </div>
        `).join('') || '<div style="color:var(--gris); font-size:0.85rem;">Aucun service inclus</div>'}
      </div>
    </div>

    <button class="btn btn-primary" style="width:100%;"
      onclick="
        fermerDetailModal();
        document.getElementById('assign-type').value = 'pack';
        document.getElementById('pack-select').value = '${p.id}';
        document.getElementById('tarif-ht').value = '${p.prix_ht}';
        document.getElementById('pack-select-group').style.display = 'block';
        document.getElementById('service-select-group').style.display = 'none';
        document.getElementById('assign-modal').classList.add('open');
      ">
      <i class="bi bi-plus-circle"></i> Assigner ce pack à un client
    </button>
  `;

  document.getElementById('detail-modal').classList.add('open');
}

function fermerDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
}

// ── Modal assignation ─────────────────────────────────────────────────────────
function closeAssignModal() {
  document.getElementById('assign-modal').classList.remove('open');
}

document.getElementById('assign-type').addEventListener('change', (e) => {
  const isPack = e.target.value === 'pack';
  document.getElementById('pack-select-group').style.display    = isPack ? 'block' : 'none';
  document.getElementById('service-select-group').style.display = isPack ? 'none' : 'block';
  document.getElementById('renew-group').style.display          = isPack ? 'none' : 'block';
});

document.getElementById('assign-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contact_id = document.getElementById('service-contact').value;
  if (!contact_id) return alert('Choisir un client');

  const type       = document.getElementById('assign-type').value;
  const date_debut = document.getElementById('date-debut').value;
  const date_fin   = document.getElementById('date-fin').value;
  const tarif_ht   = parseFloat(document.getElementById('tarif-ht').value) || 0;

  try {
    if (type === 'service') {
      const service_id = document.getElementById('service-select').value;
      await api.post('/api/services/assign-service', {
        contact_id, service_id, date_debut, date_fin, tarif_ht,
        renouvellement_auto: document.getElementById('renew-auto').value
      });
    } else {
      const pack_id = document.getElementById('pack-select').value;
      await api.post('/api/services/assign-pack', {
        contact_id, pack_id, date_debut, date_fin, tarif_ht
      });
    }
    closeAssignModal();
    await loadServices();
  } catch (err) {
    alert(err.message);
  }
});

loadServices();