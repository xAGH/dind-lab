const loginPanel = document.getElementById('login-panel');
const loginForm = document.getElementById('login-form');
const idInput = document.getElementById('student-id');
const statusPanel = document.getElementById('status-panel');
const statusBadge = document.getElementById('status-badge');
const statusId = document.getElementById('status-id');
const statusMessage = document.getElementById('status-message');
const spinner = document.getElementById('spinner');
const changeIdBtn = document.getElementById('change-id-btn');

const STORAGE_KEY = 'dind-lab-student-id';
const POLL_MS = 3000;

const MESSAGES = {
  inactivo: 'Tu instructor todavia no encendio tu instancia. Esta pagina se actualiza sola en cuanto lo haga.',
  iniciando: 'Tu instancia esta arrancando (el motor de Docker interno tarda unos segundos en estar listo)…',
  error: 'Tu instancia tuvo un problema al arrancar. Avisa a tu instructor.',
  activo: 'Listo. Entrando a tu terminal…',
};

let pollTimer = null;

function showStatusPanel(id) {
  loginPanel.classList.add('hidden');
  statusPanel.classList.add('visible');
  statusId.textContent = id;
}

function showLoginPanel() {
  loginPanel.classList.remove('hidden');
  statusPanel.classList.remove('visible');
  if (pollTimer) clearInterval(pollTimer);
}

function render(status) {
  statusBadge.textContent = status;
  statusBadge.className = `badge ${status}`;
  statusMessage.textContent = MESSAGES[status] ?? 'Consultando…';
  statusMessage.classList.toggle('err', status === 'error');
  statusMessage.classList.toggle('ok', status === 'activo');
  spinner.style.display = status === 'iniciando' || status === 'deteniendo' ? 'block' : 'none';
}

async function poll(id) {
  try {
    const res = await fetch(`/api/lookup/${encodeURIComponent(id)}`);
    if (res.status === 404) {
      render('error');
      statusMessage.textContent = 'No existe un aprendiz con ese identificador. Revisa que este bien escrito.';
      return;
    }
    if (!res.ok) return; // error transitorio (429, etc.) -- se reintenta en el proximo ciclo
    const data = await res.json();
    render(data.status);
    if (data.status === 'activo' && data.url) {
      clearInterval(pollTimer);
      setTimeout(() => window.location.assign(data.url), 600);
    }
  } catch {
    // sin conexion momentanea: se reintenta solo
  }
}

function startPolling(id) {
  showStatusPanel(id);
  render('inactivo');
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

const savedId = localStorage.getItem(STORAGE_KEY);
if (savedId) {
  idInput.value = savedId;
  startPolling(savedId);
}
