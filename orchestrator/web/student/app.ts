import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/student.css';

import type { LookupResult, InstanceStatus } from '../types.js';

// --- DOM ---

const loginPanel   = document.getElementById('login-panel')!;
const loginForm    = document.getElementById('login-form') as HTMLFormElement;
const idInput      = document.getElementById('student-id') as HTMLInputElement;
const statusPanel  = document.getElementById('status-panel')!;
const statusIdLine = document.getElementById('status-id-line')!;
const statusBadge  = document.getElementById('status-badge')!;
const outputEl     = document.getElementById('term-output')!;
const progressEl   = document.getElementById('term-progress')!;
const changeIdBtn  = document.getElementById('change-id-btn')!;

const STORAGE_KEY = 'dind-lab-student-id';
const POLL_MS     = 3000;

// Mensajes de salida por estado — formato terminal
const OUTPUT: Record<InstanceStatus | 'not-found', string[]> = {
  inactivo: [
    'Tu instancia está inactiva.',
    'Esperando a que el instructor la encienda.',
    'Esta página se actualiza automáticamente.',
  ],
  iniciando: [
    'Iniciando dockerd interno…',
    'Este proceso toma unos segundos.',
  ],
  deteniendo: [
    'Deteniendo la instancia…',
  ],
  activo: [
    'Instancia lista. Abriendo tu terminal…',
  ],
  error: [
    'La instancia tuvo un problema al arrancar.',
    'Avisa a tu instructor.',
  ],
  'not-found': [
    'ERROR: id no encontrado.',
    'Verifica tu identificador con el instructor.',
  ],
};

const OUTPUT_CLASS: Partial<Record<InstanceStatus | 'not-found', string>> = {
  activo:    'term-output-line--ok',
  error:     'term-output-line--err',
  'not-found': 'term-output-line--err',
  iniciando: 'term-output-line--warn',
  deteniendo: 'term-output-line--warn',
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

function renderOutput(key: InstanceStatus | 'not-found'): void {
  const lines = OUTPUT[key] ?? ['Consultando…'];
  const cls   = OUTPUT_CLASS[key] ?? '';
  outputEl.innerHTML = lines
    .map((l) => `<span class="term-output-line${cls ? ` ${cls}` : ''}">${escHtml(l)}</span>`)
    .join('');
}

function renderBadge(status: InstanceStatus): void {
  const labels: Record<InstanceStatus, string> = {
    activo:     'activo',
    inactivo:   'inactivo',
    iniciando:  'iniciando…',
    deteniendo: 'deteniendo…',
    error:      'error',
  };
  statusBadge.className = `status-badge status-badge--${status}`;
  statusBadge.innerHTML = `<span class="status-dot-inline"></span>${labels[status]}`;
}

function showProgress(visible: boolean): void {
  progressEl.hidden = !visible;
}

function showStatusPanel(id: string): void {
  loginPanel.classList.add('hidden');
  statusPanel.classList.add('visible');
  statusIdLine.innerHTML =
    `<span class="status-id-label">lab:~$</span> status <span class="mono">${escHtml(id)}</span>`;
}

function showLoginPanel(): void {
  loginPanel.classList.remove('hidden');
  statusPanel.classList.remove('visible');
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function applyState(status: InstanceStatus): void {
  renderBadge(status);
  renderOutput(status);
  showProgress(status === 'iniciando' || status === 'deteniendo');
}

async function poll(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/lookup/${encodeURIComponent(id)}`);
    if (res.status === 404) {
      renderOutput('not-found');
      renderBadge('error');
      showProgress(false);
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      return;
    }
    if (!res.ok) return; // transitorio: se reintenta solo
    const data: LookupResult = await res.json();
    applyState(data.status);
    if (data.status === 'activo' && data.url) {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      setTimeout(() => window.location.assign(data.url!), 700);
    }
  } catch {
    // sin conexión momentánea: se reintenta solo
  }
}

function startPolling(id: string): void {
  showStatusPanel(id);
  applyState('inactivo');
  poll(id);
  pollTimer = setInterval(() => poll(id), POLL_MS);
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = idInput.value.trim().toLowerCase();
  if (!id) return;
  localStorage.setItem(STORAGE_KEY, id);
  startPolling(id);
});

changeIdBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  showLoginPanel();
});

function escHtml(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));
}

// Auto-arranque si hay id guardado
const savedId = localStorage.getItem(STORAGE_KEY);
if (savedId) {
  idInput.value = savedId;
  startPolling(savedId);
}
