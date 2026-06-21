// public/js/departments.js
async function loadDepartments() {
  await initSidebar('organigramme');

  const departments = await api.get('/api/departments');
  document.getElementById('departments-tbody').innerHTML = departments.map(d => `
    <tr>
      <td>${d.nom}</td>
      <td>${d.parent_id || '—'}</td>
      <td>${d.responsable || '—'}</td>
      <td>${d.telephone || '—'}</td>
    </tr>
  `).join('');

  const options = departments.map(d => `<option value="${d.id}">${d.nom}</option>`).join('');
  document.getElementById('dept-parent').innerHTML = `<option value="">— Aucun —</option>` + options;
}

function openDeptModal() {
  document.getElementById('dept-form').reset();
  document.getElementById('dept-modal').classList.add('open');
}

function closeDeptModal() {
  document.getElementById('dept-modal').classList.remove('open');
}

document.getElementById('dept-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nom = document.getElementById('dept-nom').value;
  const parent_id = document.getElementById('dept-parent').value || null;
  const responsable = document.getElementById('dept-responsable').value;
  const telephone = document.getElementById('dept-telephone').value;
  const description = document.getElementById('dept-description').value;

  try {
    await api.post('/api/departments', { nom, parent_id, responsable, telephone, description });
    closeDeptModal();
    await loadDepartments();
  } catch (err) {
    alert(err.message);
  }
});

loadDepartments();
