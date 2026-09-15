import { api, ApiError } from './api.js';
import { showToast } from './toast.js';
import { addStudentModal, bulkModal, confirmModal, logsModal } from './modals.js';
import { renderTable, distinctGroups } from './table.js';
import { connectEvents } from './sse.js';

const loginScreen = document.getElementById('login-screen');
const appRoot = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const tableBody = document.getElementById('table-body');
const groupTabs = document.getElementById('group-tabs');
const quotaEl = document.getElementById('quota');
const selectionCountEl = document.getElementById('selection-count');
const selectAllCheckbox = document.getElementById('select-all');
const btnActivateSelected = document.getElementById('btn-activate-selected');
const btnDeactivateSelected = document.getElementById('btn-deactivate-selected');

let students = [];
let selectedIds = new Set();
let activeGroup = 'todos';

function visibleStudents() {
  if (activeGroup === 'todos') return students;
  return students.filter((s) => (s.group || 'default') === activeGroup);
}

function renderTabs() {
  const groups = distinctGroups(students);
  const tabs = ['todos', ...groups];
  groupTabs.innerHTML = tabs
    .map(
      (g) =>
        `<button type="button" data-group="${g}" class="${g === activeGroup ? 'active' : ''}">${g === 'todos' ? 'Todos' : g}</button>`,
    )
    .join('');
}

function renderSelectionUi() {
  const count = selectedIds.size;
  selectionCountEl.textContent = count > 0 ? `${count} seleccionados` : '';
  btnActivateSelected.disabled = count === 0;
  btnDeactivateSelected.disabled = count === 0;
}

function render() {
  renderTabs();
  renderTable(tableBody, visibleStudents(), selectedIds);
  renderSelectionUi();
}

async function refreshSummary() {
  try {
    const summary = await api.summary();
    quotaEl.textContent = `${summary.activeCount}/${summary.maxActive} activos`;
    quotaEl.classList.toggle('full', summary.activeCount >= summary.maxActive);
  } catch {
    quotaEl.textContent = '—';
  }
}

async function loadStudents({ silent = false } = {}) {
  try {
    const data = await api.listStudents();
    students = data;
    // Descarta selecciones de aprendices que ya no existen.
    selectedIds = new Set([...selectedIds].filter((id) => students.some((s) => s.id === id)));
    render();
    refreshSummary();
  } catch (err) {
    if (!silent) showToast(err.message, true);
  }
}

// --- Login ---

async function checkSession() {
  try {
    const { authenticated } = await api.session();
    if (authenticated) enterApp();
    else showLogin();
  } catch {
    showLogin();
  }
}

function showLogin() {
  loginScreen.style.display = 'flex';
  appRoot.classList.remove('visible');
}

function enterApp() {
  loginScreen.style.display = 'none';
  appRoot.classList.add('visible');
  loadStudents();
  connectEvents(() => loadStudents({ silent: true }));
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const user = document.getElementById('user').value.trim();
  const password = document.getElementById('password').value;
  try {
    await api.login(user, password);
    enterApp();
  } catch (err) {
    loginError.textContent = err instanceof ApiError ? err.message : 'No se pudo iniciar sesion.';
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await api.logout().catch(() => undefined);
  showLogin();
});

// --- Tabs ---

groupTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-group]');
  if (!btn) return;
  activeGroup = btn.dataset.group;
  selectedIds.clear();
  render();
});

// --- Toolbar ---

document.getElementById('btn-add').addEventListener('click', async () => {
  const result = await addStudentModal();
  if (!result) return;
  try {
    await api.addStudent(result.id, result.group);
    showToast(`${result.id} agregado`);
    loadStudents();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('btn-bulk').addEventListener('click', async () => {
  const result = await bulkModal();
  if (!result) return;
  try {
    const created = await api.addBulk(result.prefix, result.count, result.group);
    showToast(`${created.length} aprendices generados`);
    loadStudents();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('btn-refresh').addEventListener('click', () => loadStudents());

document.getElementById('btn-print').addEventListener('click', () => {
  window.open('/admin/print.html', '_blank', 'noopener');
});

document.getElementById('btn-export').addEventListener('click', () => {
  const header = 'id,grupo,estado,clave,url\n';
  const rows = students
    .map((s) => [s.id, s.group || 'default', s.status, s.password, s.url ?? ''].join(','))
    .join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aprendices-docker-lab.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// --- Selección y acciones masivas ---

selectAllCheckbox.addEventListener('change', () => {
  if (selectAllCheckbox.checked) {
    visibleStudents().forEach((s) => selectedIds.add(s.id));
  } else {
    visibleStudents().forEach((s) => selectedIds.delete(s.id));
  }
  render();
});

async function runBulk(action) {
  const ids = [...selectedIds];
  if (ids.length === 0) return;
  const verb = action === 'activate' ? 'encender' : 'apagar';
  const ok = await confirmModal(
    `${verb === 'encender' ? 'Encender' : 'Apagar'} ${ids.length} instancias`,
    `Se van a ${verb} ${ids.length} instancias. Puede tardar unos segundos.`,
  );
  if (!ok) return;
  try {
    const result = await api.bulkAction(action, ids);
    if (result.failed.length > 0) {
      showToast(`${result.ok.length} ok, ${result.failed.length} fallaron`, true);
    } else {
      showToast(`${result.ok.length} instancias actualizadas`);
    }
    loadStudents();
  } catch (err) {
    showToast(err.message, true);
  }
}

btnActivateSelected.addEventListener('click', () => runBulk('activate'));
btnDeactivateSelected.addEventListener('click', () => runBulk('deactivate'));

// --- Delegación de eventos de la tabla ---

tableBody.addEventListener('change', async (e) => {
  const target = e.target;

  if (target.classList.contains('row-select')) {
    const id = target.dataset.id;
    if (target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    renderSelectionUi();
    return;
  }

  if (target.classList.contains('toggle')) {
    const id = target.dataset.id;
    target.disabled = true;
    const action = target.checked ? 'activate' : 'deactivate';
    try {
      await (action === 'activate' ? api.activate(id) : api.deactivate(id));
      showToast(action === 'activate' ? `${id}: encendiendo…` : `${id}: instancia detenida`);
    } catch (err) {
      target.checked = !target.checked;
      showToast(err.message, true);
    } finally {
      loadStudents();
    }
  }
});

tableBody.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const id = target.dataset.id;
  const action = target.dataset.action;

  if (action === 'copy-password') {
    try {
      await navigator.clipboard.writeText(target.dataset.password);
      showToast('Clave copiada');
    } catch {
      showToast('No se pudo copiar la clave', true);
    }
    return;
  }

  if (action === 'logs') {
    try {
      const text = await api.logs(id);
      logsModal(id, text || '(sin salida)');
    } catch (err) {
      showToast(err.message, true);
    }
    return;
  }

  if (action === 'regenerate') {
    const ok = await confirmModal('Regenerar clave', `Se generara una clave nueva para ${id}. La anterior deja de servir.`);
    if (!ok) return;
    try {
      await api.regeneratePassword(id);
      showToast(`Clave de ${id} regenerada`);
      loadStudents();
    } catch (err) {
      showToast(err.message, true);
    }
    return;
  }

  if (action === 'wipe') {
    const ok = await confirmModal(
      'Borrar datos guardados',
      `Esto elimina permanentemente el workspace y las imagenes que ${id} construyo. No se puede deshacer.`,
      { danger: true, confirmLabel: 'Borrar' },
    );
    if (!ok) return;
    try {
      await api.wipeData(id);
      showToast(`Datos de ${id} borrados`);
      loadStudents();
    } catch (err) {
      showToast(err.message, true);
    }
    return;
  }

  if (action === 'delete') {
    const ok = await confirmModal(
      'Eliminar aprendiz',
      `Esto detiene y elimina la instancia de ${id}, junto con su workspace e imagenes. No se puede deshacer.`,
      { danger: true, confirmLabel: 'Eliminar' },
    );
    if (!ok) return;
    try {
      await api.remove(id);
      showToast(`${id} eliminado`);
      loadStudents();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

checkSession();
