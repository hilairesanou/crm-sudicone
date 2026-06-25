// public/js/services-public.js
let publicServices = [];
let publicPacks    = [];
let selectedServiceId = null;
let selectedPackId    = null;

async function initServicesPublicPage() {
  try {
    const [services, packs] = await Promise.all([
      api.get('/api/public/services'),
      api.get('/api/public/packs')
    ]);
    publicServices = services || [];
    publicPacks    = packs    || [];
    renderServices(publicServices);
    renderPacks(publicPacks);
    populateSelects(publicServices, publicPacks);
  } catch (err) {
    console.error(err);
  }
}

// ── Rendu services ────────────────────────────────────────────────────────────
function renderServices(services) {
  const grid = document.getElementById('services-grid');
  if (!services.length) {
    grid.innerHTML = `<p style="color:#9ca3af; text-align:center; grid-column:1/-1;">Aucun service disponible pour le moment.</p>`;
    return;
  }
  grid.innerHTML = services.map(s => `
    <article class="service-card">
      <span class="card-badge">${s.categorie}</span>
      <h3>${s.titre}</h3>
      <p>${s.description || 'Service professionnel SUDICONE.'}</p>
      <div class="card-price">
        <strong>${formatMontant(s.prix_ht)}</strong>
        <span>HT / ${s.duree_mois} mois</span>
      </div>
      <div class="card-actions">
        <button class="btn-choisir" id="btn-service-${s.id}"
          onclick="selectService(${s.id})">
          <i class="bi bi-check2"></i> Choisir
        </button>
        <button class="btn-detail" onclick="showServiceDetails(${s.id})">
          Détails
        </button>
      </div>
    </article>
  `).join('');
}

// ── Rendu packs ───────────────────────────────────────────────────────────────
function renderPacks(packs) {
  const grid = document.getElementById('packs-grid');
  if (!packs.length) {
    grid.innerHTML = `<p style="color:#9ca3af; text-align:center; grid-column:1/-1;">Aucun pack disponible pour le moment.</p>`;
    return;
  }
  grid.innerHTML = packs.map((p, i) => `
    <article class="service-card ${i === 0 ? 'featured' : ''}">
      ${i === 0 ? '<span class="card-badge recommended">⭐ Recommandé</span>' : '<span class="card-badge gold">Pack</span>'}
      <h3>${p.nom}</h3>
      <p>${p.description || 'Pack tout-en-un pour votre communication.'}</p>
      <div class="pack-services-list">
        ${p.services.map(s => `<span>${s.titre}</span>`).join('')}
      </div>
      <div class="card-price">
        <strong>${formatMontant(p.prix_ht)}</strong>
        <span>HT / ${p.duree_mois} mois</span>
      </div>
      <div class="card-actions">
        <button class="btn-choisir" id="btn-pack-${p.id}"
          onclick="selectPack(${p.id})">
          <i class="bi bi-check2"></i> Choisir ce pack
        </button>
        <button class="btn-detail" onclick="showPackDetails(${p.id})">
          Détails
        </button>
      </div>
    </article>
  `).join('');
}

// ── Remplir les selects ───────────────────────────────────────────────────────
function populateSelects(services, packs) {
  document.getElementById('selected-service').innerHTML =
    '<option value="">— Choisir un service —</option>' +
    services.map(s => `<option value="${s.id}">${s.titre} — ${formatMontant(s.prix_ht)}</option>`).join('');

  document.getElementById('selected-pack').innerHTML =
    '<option value="">— Choisir un pack —</option>' +
    packs.map(p => `<option value="${p.id}">${p.nom} — ${formatMontant(p.prix_ht)}</option>`).join('');

  // Écouter les changements dans les selects
  document.getElementById('selected-service').addEventListener('change', function() {
    if (this.value) {
      const s = publicServices.find(x => x.id === parseInt(this.value));
      if (s) selectService(s.id, false);
    }
  });
  document.getElementById('selected-pack').addEventListener('change', function() {
    if (this.value) {
      const p = publicPacks.find(x => x.id === parseInt(this.value));
      if (p) selectPack(p.id, false);
    }
  });
}

// ── Sélectionner un service ───────────────────────────────────────────────────
function selectService(id, scroll = true) {
  const service = publicServices.find(s => s.id === id);
  if (!service) return;

  selectedServiceId = id;
  selectedPackId    = null;

  // Mettre à jour les selects
  document.getElementById('selected-service').value = id;
  document.getElementById('selected-pack').value    = '';

  // Mettre à jour le tarif
  document.getElementById('tarif_ht').value = service.prix_ht || '';

  // Mettre à jour la box visuelle
  const box = document.getElementById('service-box');
  box.classList.add('active');
  document.getElementById('service-label').textContent =
    `${service.titre} — ${formatMontant(service.prix_ht)}`;

  document.getElementById('pack-box').classList.remove('active');
  document.getElementById('pack-label').textContent = 'Aucun pack sélectionné';

  // Mettre à jour les boutons
  document.querySelectorAll('[id^="btn-service-"]').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('[id^="btn-pack-"]').forEach(b => b.classList.remove('selected'));
  const btn = document.getElementById(`btn-service-${id}`);
  if (btn) { btn.classList.add('selected'); btn.innerHTML = '<i class="bi bi-check2-circle"></i> Sélectionné'; }

  showToast(`✓ ${service.titre} sélectionné`);
  if (scroll) document.getElementById('souscrire').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Sélectionner un pack ──────────────────────────────────────────────────────
function selectPack(id, scroll = true) {
  const pack = publicPacks.find(p => p.id === id);
  if (!pack) return;

  selectedPackId    = id;
  selectedServiceId = null;

  document.getElementById('selected-pack').value    = id;
  document.getElementById('selected-service').value = '';
  document.getElementById('tarif_ht').value = pack.prix_ht || '';

  const box = document.getElementById('pack-box');
  box.classList.add('active');
  document.getElementById('pack-label').textContent =
    `${pack.nom} — ${formatMontant(pack.prix_ht)}`;

  document.getElementById('service-box').classList.remove('active');
  document.getElementById('service-label').textContent = 'Aucun service sélectionné';

  document.querySelectorAll('[id^="btn-pack-"]').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('[id^="btn-service-"]').forEach(b => b.classList.remove('selected'));
  const btn = document.getElementById(`btn-pack-${id}`);
  if (btn) { btn.classList.add('selected'); btn.innerHTML = '<i class="bi bi-check2-circle"></i> Sélectionné'; }

  showToast(`✓ Pack ${pack.nom} sélectionné`);
  if (scroll) document.getElementById('souscrire').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Modal détail service ──────────────────────────────────────────────────────
function showServiceDetails(id) {
  const s = publicServices.find(x => x.id === id);
  if (!s) return;
  document.getElementById('detail-modal-content').innerHTML = `
    <div style="margin-bottom:20px;">
      <span style="font-size:0.72rem; font-weight:700; color:#c9a84c;
                   text-transform:uppercase; letter-spacing:2px;">${s.categorie}</span>
      <h2 style="font-size:1.4rem; font-weight:800; color:#0b2545; margin:6px 0;">${s.titre}</h2>
      <div style="font-size:1.5rem; font-weight:800; color:#0b2545;">${formatMontant(s.prix_ht)}<span style="font-size:0.8rem; font-weight:400; color:#6b7280;"> HT / ${s.duree_mois} mois</span></div>
    </div>
    <p style="color:#6b7280; font-size:0.9rem; line-height:1.7; margin-bottom:20px;">
      ${s.description || 'Service professionnel SUDICONE.'}
    </p>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">
      <div style="background:#f7f8fa; border-radius:8px; padding:12px;">
        <div style="font-size:0.72rem; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">Durée</div>
        <div style="font-weight:700; color:#0b2545;">${s.duree_mois} mois</div>
      </div>
      <div style="background:#f7f8fa; border-radius:8px; padding:12px;">
        <div style="font-size:0.72rem; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">Catégorie</div>
        <div style="font-weight:700; color:#0b2545;">${s.categorie}</div>
      </div>
    </div>
    <button class="btn-submit" onclick="selectService(${s.id}); closeDetailModal();" style="width:100%;">
      <i class="bi bi-check2-circle"></i> Choisir ce service
    </button>
  `;
  document.getElementById('detail-modal').classList.add('open');
}

// ── Modal détail pack ─────────────────────────────────────────────────────────
function showPackDetails(id) {
  const p = publicPacks.find(x => x.id === id);
  if (!p) return;
  document.getElementById('detail-modal-content').innerHTML = `
    <div style="margin-bottom:20px;">
      <span style="font-size:0.72rem; font-weight:700; color:#c9a84c;
                   text-transform:uppercase; letter-spacing:2px;">Pack complet</span>
      <h2 style="font-size:1.4rem; font-weight:800; color:#0b2545; margin:6px 0;">${p.nom}</h2>
      <div style="font-size:1.5rem; font-weight:800; color:#0b2545;">${formatMontant(p.prix_ht)}<span style="font-size:0.8rem; font-weight:400; color:#6b7280;"> HT / ${p.duree_mois} mois</span></div>
    </div>
    <p style="color:#6b7280; font-size:0.9rem; line-height:1.7; margin-bottom:20px;">
      ${p.description || 'Pack tout-en-un pour votre communication.'}
    </p>
    <div style="margin-bottom:20px;">
      <div style="font-size:0.78rem; font-weight:700; color:#0b2545; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Services inclus</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${p.services.map(s => `
          <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; color:#374151;">
            <i class="bi bi-check2-circle" style="color:#16a34a;"></i> ${s.titre}
          </div>
        `).join('')}
      </div>
    </div>
    <button class="btn-submit" onclick="selectPack(${p.id}); closeDetailModal();" style="width:100%;">
      <i class="bi bi-check2-circle"></i> Choisir ce pack
    </button>
  `;
  document.getElementById('detail-modal').classList.add('open');
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="bi bi-check2-circle"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Soumission formulaire ─────────────────────────────────────────────────────
async function handleSubscription(event) {
  event.preventDefault();

  const serviceId = document.getElementById('selected-service').value;
  const packId    = document.getElementById('selected-pack').value;

  if (!serviceId && !packId) {
    showFeedback('Veuillez choisir un service ou un pack avant d\'envoyer.', 'error');
    document.getElementById('services').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const data = {
    nom:        document.getElementById('nom').value.trim(),
    entreprise: document.getElementById('entreprise').value.trim(),
    email:      document.getElementById('email').value.trim(),
    telephone:  document.getElementById('telephone').value.trim(),
    pays:       document.getElementById('pays').value.trim(),
    site_web:   document.getElementById('site_web').value.trim(),
    message:    document.getElementById('message').value.trim(),
    service_id: serviceId || null,
    pack_id:    packId    || null,
    date_debut: document.getElementById('date_debut').value || null,
    date_fin:   document.getElementById('date_fin').value   || null,
    tarif_ht:   document.getElementById('tarif_ht').value
                  ? Number(document.getElementById('tarif_ht').value) : null,
    renouvellement_auto: document.getElementById('renewal').checked,
    mode_paiement: null
  };

  const btn = document.querySelector('.btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Envoi en cours...';

  try {
    const res = await api.post('/api/public/leads', data);
    showFeedback(res.message || 'Votre demande a bien été envoyée. Nous vous contactons sous 24h.', 'success');
    document.getElementById('subscribe-form').reset();
    selectedServiceId = null;
    selectedPackId    = null;
    document.getElementById('service-box').classList.remove('active');
    document.getElementById('pack-box').classList.remove('active');
    document.getElementById('service-label').textContent = 'Aucun service sélectionné';
    document.getElementById('pack-label').textContent    = 'Aucun pack sélectionné';
    document.querySelectorAll('.btn-choisir').forEach(b => {
      b.classList.remove('selected');
      b.innerHTML = '<i class="bi bi-check2"></i> Choisir';
    });
  } catch (err) {
    showFeedback(err.message || 'Erreur lors de l\'envoi. Réessayez.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-send-fill"></i> Envoyer ma demande';
  }
}

function showFeedback(msg, type) {
  const el = document.getElementById('subscribe-feedback');
  el.textContent = msg;
  el.className   = `feedback ${type}`;
}

document.addEventListener('DOMContentLoaded', () => {
  initServicesPublicPage();
  document.getElementById('subscribe-form').addEventListener('submit', handleSubscription);
});