// public/js/departments.js

async function loadDepartments() {
  await initSidebar('organigramme');
  const departments = await api.get('/api/departments');
  renderOrgChart(departments);
  populateParentSelect(departments);
}

function renderOrgChart(departments) {
  const container = document.getElementById('org-chart');
  const roots = departments.filter(d => !d.parent_id);
  const children = departments.filter(d => d.parent_id);

  if (departments.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#888;">Aucun département enregistré.</p>';
    return;
  }

  // On prend uniquement la première racine
  const root = roots[0];

  let html = '<div class="org-root">';

  // Node racine
  html += `
    <div class="org-node-root">
      <h3>${root.nom}</h3>
      <p>${root.responsable || ''}</p>
      <div class="org-node-actions" style="margin-top:8px;">
        <button onclick="editDept(${root.id})" style="color:#fff;border-color:rgba(255,255,255,0.4);">
          <i class="bi bi-pencil"></i>
        </button>
        <button onclick="deleteDept(${root.id})" style="color:#fff;border-color:rgba(255,255,255,0.4);">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `;

  // Enfants directs de la racine
  const rootChildren = children.filter(d => d.parent_id === root.id);

  if (rootChildren.length > 0) {
    html += '<div class="org-connector-down"></div>';
    html += '<div class="org-children">';
    rootChildren.forEach(child => {
      html += `
        <div class="org-child-wrapper">
          <div class="org-child-connector"></div>
          <div class="org-node-child">
            <h3>${child.nom}</h3>
            <div class="responsable">${child.responsable || '—'}</div>
            <div class="org-node-actions">
              <button onclick="editDept(${child.id})">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="danger" onclick="deleteDept(${child.id})">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function populateParentSelect(departments) {
  const options = departments.map(d =>
    `<option value="${d.id}">${d.nom}</option>`
  ).join('');
  document.getElementById('dept-parent').innerHTML =
    `<option value="">— Aucun (racine) —</option>` + options;
}

function openDeptModal() {
  document.getElementById('dept-form').reset();
  document.getElementById('dept-id').value = '';
  document.getElementById('dept-modal-title').textContent = 'Créer un département';
  document.getElementById('dept-modal').classList.add('open');
}

function closeDeptModal() {
  document.getElementById('dept-modal').classList.remove('open');
}

async function editDept(id) {
  const departments = await api.get('/api/departments');
  const dept = departments.find(d => d.id === id);
  if (!dept) return;
  document.getElementById('dept-id').value = dept.id;
  document.getElementById('dept-nom').value = dept.nom;
  document.getElementById('dept-parent').value = dept.parent_id || '';
  document.getElementById('dept-responsable').value = dept.responsable || '';
  document.getElementById('dept-telephone').value = dept.telephone || '';
  document.getElementById('dept-description').value = dept.description || '';
  document.getElementById('dept-modal-title').textContent = 'Modifier le département';
  document.getElementById('dept-modal').classList.add('open');
}

async function deleteDept(id) {
  if (!confirm('Supprimer ce département ?')) return;
  await api.del(`/api/departments/${id}`);
  await loadDepartments();
}

document.getElementById('dept-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('dept-id').value;
  const data = {
    nom: document.getElementById('dept-nom').value,
    parent_id: document.getElementById('dept-parent').value || null,
    responsable: document.getElementById('dept-responsable').value,
    telephone: document.getElementById('dept-telephone').value,
    description: document.getElementById('dept-description').value
  };

  try {
    if (id) {
      await api.put(`/api/departments/${id}`, data);
    } else {
      await api.post('/api/departments', data);
    }
    closeDeptModal();
    await loadDepartments();
  } catch (err) {
    alert(err.message);
  }
});

loadDepartments();