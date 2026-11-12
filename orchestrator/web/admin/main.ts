import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/admin.css';

import type { Student } from '../types.js';
import { api, ApiError } from './api.js';
import { showToast } from './toast.js';
import { confirmModal, addStudentModal, bulkModal, logsModal } from './modals.js';
import { renderTable, renderSkeleton, distinctGroups } from './table.js';
import { connectEvents } from './sse.js';

// --- Elementos del DOM ---

const loginScreen   = document.getElementById('login-screen')!;
const appRoot       = document.getElementById('app')!;
const loginForm     = document.getElementById('login-form') as HTMLFormElement;
const loginError    = document.getElementById('login-error')!;
const tableBody     = document.getElementById('table-body')!;
const groupTabs     = document.getElementById('group-tabs')!;
const quotaEl       = document.getElementById('quota')!;
const selCountEl    = document.getElementById('selection-count')!;
const selectAllCb   = document.getElementById('select-all') as HTMLInputElement;
const btnActivate   = document.getElementById('btn-activate-selected') as HTMLButtonElement;
const btnDeactivate = document.getElementById('btn-deactivate-selected') as HTMLButtonElement;

// --- Estado ---

let students: Student[] = [];
let selectedIds = new Set<string>();
let activeGroup = 'todos';

function visibleStudents(): Student[] {
  if (activeGroup === 'todos') return students;
  return students.filter((s) => (s.group || 'default') === activeGroup);
}

// --- Renderizado ---

function renderTabs(): void {
  const groups = distinctGroups(students);
  const tabs = ['todos', ...groups];
  groupTabs.innerHTML = tabs
    .map((g) => {
      const label = g === 'todos' ? 'Todos' : g;
      const count = g === 'todos' ? students.length : students.filter((s) => (s.group || 'default') === g).length;
      return `<button type="button" class="group-tab${g === activeGroup ? ' group-tab--active' : ''}" data-group="${g}">
        ${label} <span class="tab-count">${count}</span>
      </button>`;
    })
    .join('');
}

function renderSelectionUi(): void {
  const count = selectedIds.size;
  selCountEl.textContent = count > 0 ? `${count} sel.` : '';
  btnActivate.disabled   = count === 0;
  btnDeactivate.disabled = count === 0;

  // Estado del checkbox maestro
  const visible = visibleStudents();
  const allChecked = visible.length > 0 && visible.every((s) => selectedIds.has(s.id));
  const someChecked = !allChecked && visible.some((s) => selectedIds.has(s.id));
  selectAllCb.checked       = allChecked;
  selectAllCb.indeterminate = someChecked;
}

function render(): void {
  renderTabs();
  renderTable(tableBody, visibleStudents(), selectedIds);
  renderSelectionUi();
}

async function refreshSummary(): Promise<void> {
  try {
    const summary = await api.summary();
    const isFull = summary.activeCount >= summary.maxActive;
    quotaEl.textContent = `${summary.activeCount} / ${summary.maxActive}`;
    quotaEl.classList.toggle('quota--full', isFull);
  } catch {
    quotaEl.textContent = '—';
  }
}

async function loadStudents({ silent = false, skeleton = false } = {}): Promise<void> {
  if (skeleton) renderSkeleton(tableBody);
  try {
    const data = await api.listStudents();
    students = data;
    // Descarta selecciones de aprendices que ya no existen
    selectedIds = new Set([...selectedIds].filter((id) => students.some((s) => s.id === id)));
    render();
    refreshSummary();
  } catch (err) {
    if (!silent) showToast(err instanceof Error ? err.message : 'Error al cargar los datos.', true);
  }
}

// --- Auth ---

async function checkSession(): Promise<void> {
  try {
    const { authenticated } = await api.session();
    if (authenticated) enterApp();
    else showLogin();
  } catch {
    showLogin();
  }
}

function showLogin(): void {
  loginScreen.removeAttribute('hidden');
  appRoot.setAttribute('hidden', '');
}

function enterApp(): void {
  loginScreen.setAttribute('hidden', '');
  appRoot.removeAttribute('hidden');
  loadStudents({ skeleton: true });
  connectEvents(() => loadStudents({ silent: true }));
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const user     = (document.getElementById('user') as HTMLInputElement).value.trim();
  const password = (document.getElementById('password') as HTMLInputElement).value;
  const btn      = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement;
  btn.disabled   = true;
  try {
    await api.login(user, password);
    enterApp();
  } catch (err) {
    loginError.textContent = err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.';
    btn.disabled = false;
  }
});

document.getElementById('btn-logout')!.addEventListener('click', async () => {
  await api.logout().catch(() => undefined);
  showLogin();
});

// --- Tabs de grupo ---

groupTabs.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-group]');
  if (!btn) return;
  activeGroup = btn.dataset.group!;
  selectedIds.clear();
  render();
});

// --- Toolbar ---

document.getElementById('btn-add')!.addEventListener('click', async () => {
  const result = await addStudentModal();
  if (!result) return;
  try {
    await api.addStudent(result.id, result.group);
    showToast(`${result.id} agregado`);
    loadStudents();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
  }
});

document.getElementById('btn-bulk')!.addEventListener('click', async () => {
  const result = await bulkModal();
  if (!result) return;
  try {
    const created = await api.addBulk(result.prefix, result.count, result.group);
    showToast(`${created.length} aprendices generados`);
    loadStudents();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
  }
});

document.getElementById('btn-refresh')!.addEventListener('click', () => loadStudents({ skeleton: true }));

document.getElementById('btn-print')!.addEventListener('click', () => {
  window.open('/admin/print.html', '_blank', 'noopener');
});

document.getElementById('btn-export')!.addEventListener('click', () => {
  const header = 'id,grupo,estado,clave,url\n';
  const rows = students
    .map((s) => [s.id, s.group || 'default', s.status, s.password, s.url ?? ''].join(','))
    .join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'aprendices-docker-lab.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// --- Selección y acciones masivas ---

selectAllCb.addEventListener('change', () => {
  if (selectAllCb.checked) visibleStudents().forEach((s) => selectedIds.add(s.id));
  else visibleStudents().forEach((s) => selectedIds.delete(s.id));
  render();
});

async function runBulk(action: 'activate' | 'deactivate'): Promise<void> {
  const ids = [...selectedIds];
  if (ids.length === 0) return;
  const verb = action === 'activate' ? 'encender' : 'apagar';
  const ok = await confirmModal(
    `${action === 'activate' ? 'Encender' : 'Apagar'} ${ids.length} instancias`,
    `Se van a ${verb} ${ids.length} instancias. Puede tardar unos segundos.`,
  );
  if (!ok) return;
  try {
    const result = await api.bulkAction(action, ids);
    if (result.failed.length > 0) {
      showToast(`${result.ok.length} actualizadas, ${result.failed.length} fallaron`, true);
    } else {
      showToast(`${result.ok.length} instancias actualizadas`);
    }
    loadStudents();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
  }
}

btnActivate.addEventListener('click',   () => runBulk('activate'));
btnDeactivate.addEventListener('click', () => runBulk('deactivate'));

// --- Delegación de eventos de la tabla ---

tableBody.addEventListener('change', async (e) => {
  const target = e.target as HTMLInputElement;

  if (target.classList.contains('row-select')) {
    const { id } = target.dataset;
    if (!id) return;
    if (target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    renderSelectionUi();
    // Resaltar / quitar resaltado de la fila
    target.closest('tr')?.classList.toggle('row--selected', target.checked);
    return;
  }

  if (target.classList.contains('toggle')) {
    const { id } = target.dataset;
    if (!id) return;
    target.disabled = true;
    const action = target.checked ? 'activate' : 'deactivate';
    try {
      await (action === 'activate' ? api.activate(id) : api.deactivate(id));
      showToast(action === 'activate' ? `${id}: encendiendo…` : `${id}: detenida`);
    } catch (err) {
      target.checked = !target.checked;
      showToast(err instanceof Error ? err.message : 'Error', true);
    } finally {
      loadStudents();
    }
  }
});

tableBody.addEventListener('click', async (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target) return;

  const { id, action, password } = target.dataset;

  if (action === 'copy-password' && password) {
    try {
      await navigator.clipboard.writeText(password);
      // Feedback visual: cambiar el icono brevemente
      const icon = target.querySelector('svg');
      if (icon) {
        const original = target.innerHTML;
        target.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8l4 4 8-8"/></svg>`;
        setTimeout(() => { target.innerHTML = original; }, 1500);
      }
      showToast('Clave copiada');
    } catch {
      showToast('No se pudo copiar al portapapeles', true);
    }
    return;
  }

  if (!id) return;

  if (action === 'logs') {
    try {
      const text = await api.logs(id);
      logsModal(id, text || '(sin salida)');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', true);
    }
    return;
  }

  if (action === 'regenerate') {
    const ok = await confirmModal(
      'Regenerar clave',
      `Se generará una clave nueva para ${id}. La clave anterior dejará de funcionar.`,
    );
    if (!ok) return;
    try {
      await api.regeneratePassword(id);
      showToast(`Clave de ${id} regenerada`);
      loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', true);
    }
    return;
  }

  if (action === 'wipe') {
    const ok = await confirmModal(
      'Borrar datos guardados',
      `Esto elimina permanentemente el workspace y las imágenes que ${id} construyó. No se puede deshacer.`,
      { danger: true, confirmLabel: 'Borrar' },
    );
    if (!ok) return;
    try {
      await api.wipeData(id);
      showToast(`Datos de ${id} borrados`);
      loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', true);
    }
    return;
  }

  if (action === 'delete') {
    const ok = await confirmModal(
      'Eliminar aprendiz',
      `Esto detiene y elimina la instancia de ${id}, junto con su workspace e imágenes. No se puede deshacer.`,
      { danger: true, confirmLabel: 'Eliminar' },
    );
    if (!ok) return;
    try {
      await api.remove(id);
      showToast(`${id} eliminado`);
      loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', true);
    }
  }
});

// --- Arranque ---
checkSession();
