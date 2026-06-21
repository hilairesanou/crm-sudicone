let publicServices = [];
let publicPacks = [];

async function initServicesPublicPage() {
  try {
    const [services, packs] = await Promise.all([
      api.get('/api/public/services'),
      api.get('/api/public/packs')
    ]);
    publicServices = services || [];
    publicPacks = packs || [];
    renderServices(publicServices);
    renderPacks(publicPacks);
    populateOptions(publicServices, publicPacks);
  } catch (error) {
    showFeedback('subscribe-feedback', 'Impossible de charger les services. Réessayez plus tard.', 'error');
    console.error(error);
  }
}

function renderServices(services) {
  const container = document.getElementById('services-carousel');
  container.innerHTML = services.map(service => `
    <article class="product-card">
      <div class="product-badge">${service.categorie}</div>
      <h3>${service.titre}</h3>
      <p>${service.description || 'Service professionnel SUDICONE.'}</p>
      <div class="product-meta">
        <strong>${formatMontant(service.prix_ht)}</strong>
        <span>${service.duree_mois} mois</span>
      </div>
      <div class="product-actions">
        <button class="btn btn-secondary" type="button" onclick="selectService(${service.id})">Choisir</button>
        <button class="btn btn-sm btn-primary" type="button" onclick="showServiceDetails(${service.id})">Détails</button>
      </div>
    </article>
  `).join('');
}

function renderPacks(packs) {
  const container = document.getElementById('packs-carousel');
  container.innerHTML = packs.map(pack => `
    <article class="product-card product-card-pack">
      <div class="product-badge pack-badge">Pack</div>
      <h3>${pack.nom}</h3>
      <p>${pack.description || 'Pack complet avec services intégrés.'}</p>
      <div class="product-meta">
        <strong>${formatMontant(pack.prix_ht)}</strong>
        <span>${pack.duree_mois} mois</span>
      </div>
      <div class="pack-services">${pack.services.map(s => `<span>${s.titre}</span>`).join('')}</div>
      <div class="product-actions">
        <button class="btn btn-secondary" type="button" onclick="selectPack(${pack.id})">Choisir</button>
        <button class="btn btn-sm btn-primary" type="button" onclick="showPackDetails(${pack.id})">Détails</button>
      </div>
    </article>
  `).join('');
}

function populateOptions(services, packs) {
  const serviceSelect = document.getElementById('selected-service');
  const packSelect = document.getElementById('selected-pack');
  serviceSelect.innerHTML = '<option value="">Aucun service sélectionné</option>' + services.map(s => `<option value="${s.id}">${s.titre} — ${formatMontant(s.prix_ht)}</option>`).join('');
  packSelect.innerHTML = '<option value="">Aucun pack sélectionné</option>' + packs.map(p => `<option value="${p.id}">${p.nom} — ${formatMontant(p.prix_ht)}</option>`).join('');
}

function scrollCarousel(id, direction) {
  const carousel = document.getElementById(id);
  carousel.scrollBy({ left: direction * 400, behavior: 'smooth' });
}

function selectService(id) {
  document.getElementById('selected-service').value = id;
  document.getElementById('selected-pack').value = '';
  document.getElementById('tarif_ht').value = publicServices.find(s => s.id === id)?.prix_ht || '';
  showFeedback('subscribe-feedback', 'Le service a été sélectionné. Complétez le formulaire et envoyez.', 'success');
}

function selectPack(id) {
  document.getElementById('selected-pack').value = id;
  document.getElementById('selected-service').value = '';
  document.getElementById('tarif_ht').value = publicPacks.find(p => p.id === id)?.prix_ht || '';
  showFeedback('subscribe-feedback', 'Le pack a été sélectionné. Complétez le formulaire et envoyez.', 'success');
}

function showServiceDetails(id) {
  const service = publicServices.find(item => item.id === id);
  if (!service) return;
  const html = `
    <div class="detail-header">
      <div>
        <span class="eyebrow">Service</span>
        <h2>${service.titre}</h2>
      </div>
      <div class="detail-price">${formatMontant(service.prix_ht)}</div>
    </div>
    <p>${service.description || 'Description détaillée non disponible.'}</p>
    <div class="detail-grid">
      <div><strong>Catégorie</strong><span>${service.categorie}</span></div>
      <div><strong>Durée</strong><span>${service.duree_mois} mois</span></div>
      <div><strong>Code</strong><span>${service.code || 'N/A'}</span></div>
    </div>
    <div class="detail-actions"><button class="btn btn-primary" type="button" onclick="selectService(${service.id}); closeDetailModal();">Choisir ce service</button></div>
  `;
  openDetailModal(html);
}

function showPackDetails(id) {
  const pack = publicPacks.find(item => item.id === id);
  if (!pack) return;
  const servicesHtml = pack.services.map(s => `<li>${s.titre}</li>`).join('');
  const html = `
    <div class="detail-header">
      <div>
        <span class="eyebrow">Pack</span>
        <h2>${pack.nom}</h2>
      </div>
      <div class="detail-price">${formatMontant(pack.prix_ht)}</div>
    </div>
    <p>${pack.description || 'Pack tout-en-un pour la gestion commerciale et la facturation.'}</p>
    <div class="detail-grid">
      <div><strong>Durée</strong><span>${pack.duree_mois} mois</span></div>
      <div><strong>Services inclus</strong><span>${pack.services.length} services</span></div>
    </div>
    <div class="detail-list"><ul>${servicesHtml}</ul></div>
    <div class="detail-actions"><button class="btn btn-primary" type="button" onclick="selectPack(${pack.id}); closeDetailModal();">Choisir ce pack</button></div>
  `;
  openDetailModal(html);
}

function openDetailModal(contentHtml) {
  document.getElementById('detail-modal-content').innerHTML = contentHtml;
  document.getElementById('detail-modal').classList.add('open');
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
}

function showFeedback(elementId, message, type = 'info') {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `feedback-message ${type}`;
}

async function handleSubscription(event) {
  event.preventDefault();
  const data = {
    nom: document.getElementById('nom').value.trim(),
    entreprise: document.getElementById('entreprise').value.trim(),
    email: document.getElementById('email').value.trim(),
    telephone: document.getElementById('telephone').value.trim(),
    adresse: '',
    ville: '',
    pays: document.getElementById('pays').value.trim(),
    site_web: document.getElementById('site_web').value.trim(),
    message: document.getElementById('message').value.trim(),
    service_id: document.getElementById('selected-service').value || null,
    pack_id: document.getElementById('selected-pack').value || null,
    date_debut: document.getElementById('date_debut').value || null,
    date_fin: document.getElementById('date_fin').value || null,
    tarif_ht: document.getElementById('tarif_ht').value ? Number(document.getElementById('tarif_ht').value) : null,
    renouvellement_auto: document.getElementById('renewal').checked,
    mode_paiement: null
  };

  try {
    const response = await api.post('/api/public/leads', data);
    showFeedback('subscribe-feedback', response.message || 'Votre demande a bien été envoyée.', 'success');
    document.getElementById('subscribe-form').reset();
    document.getElementById('tarif_ht').value = '';
  } catch (error) {
    showFeedback('subscribe-feedback', error.message || 'Erreur lors de l’envoi. Réessayez.', 'error');
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initServicesPublicPage();
  document.getElementById('subscribe-form').addEventListener('submit', handleSubscription);
});
