const tableBody = document.getElementById('table-body');
const toast = document.getElementById('toast');

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Ocurrio un error');
  }
  return data;
}

function row(student) {
  const tr = document.createElement('tr');

  const isActive = student.status === 'activo';

  tr.innerHTML = `
    <td>${student.id}</td>
    <td><span class="badge ${student.status}">${student.status}</span></td>
    <td>${
      student.url
        ? `<a class="link" href="${student.url}" target="_blank" rel="noopener">${student.url}</a>`
        : '<span class="pw">—</span>'
    }</td>
    <td><span class="pw">${student.password}</span></td>
    <td style="text-align:right; white-space:nowrap;">
      <label class="switch">
        <input type="checkbox" ${isActive ? 'checked' : ''} data-id="${student.id}" class="toggle" />
        <span class="slider"></span>
      </label>
      <button class="icon-btn" data-id="${student.id}" data-action="delete" title="Eliminar aprendiz">✕</button>
    </td>
  `;
  return tr;
}

async function loadStudents() {
  try {
    const students = await api('/api/students');
    tableBody.innerHTML = '';
    if (students.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="empty">Aun no hay aprendices. Agrega el primero.</td></tr>';
      return;
    }
    students
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      .forEach((s) => tableBody.appendChild(row(s)));
  } catch (err) {
    showToast(err.message, true);
  }
}

tableBody.addEventListener('change', async (e) => {
  const target = e.target;
  if (!target.classList.contains('toggle')) return;

  const id = target.dataset.id;
  target.disabled = true;
  const action = target.checked ? 'activate' : 'deactivate';

  try {
    await api(`/api/students/${id}/${action}`, { method: 'POST' });
    showToast(
      target.checked ? `${id}: instancia activada` : `${id}: instancia detenida`,
    );
  } catch (err) {
    target.checked = !target.checked;
    showToast(err.message, true);
  } finally {
    target.disabled = false;
    loadStudents();
  }
});

tableBody.addEventListener('click', async (e) => {
  const target = e.target;
  if (target.dataset.action !== 'delete') return;

  const id = target.dataset.id;
  if (!confirm(`¿Eliminar a ${id}? Esto detiene y borra su instancia si esta activa.`)) return;

  try {
    await api(`/api/students/${id}`, { method: 'DELETE' });
    showToast(`${id} eliminado`);
    loadStudents();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('btn-add').addEventListener('click', async () => {
  const id = prompt('Id del aprendiz (minusculas, sin espacios). Ej: jsuarez');
  if (!id) return;
  try {
    await api('/api/students', { method: 'POST', body: JSON.stringify({ id: id.trim().toLowerCase() }) });
    showToast(`${id} agregado`);
    loadStudents();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('btn-bulk').addEventListener('click', async () => {
  const count = parseInt(prompt('¿Cuantos aprendices generar? (ej: 25)'), 10);
  if (!count || count <= 0) return;
  const prefix = prompt('Prefijo para los ids', 'alumno') || 'alumno';
  try {
    await api('/api/students', { method: 'POST', body: JSON.stringify({ count, prefix }) });
    showToast(`${count} aprendices generados`);
    loadStudents();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('btn-refresh').addEventListener('click', loadStudents);

loadStudents();
setInterval(loadStudents, 15000);
