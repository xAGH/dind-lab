import { icons } from './icons.js';

type ToastKind = 'info' | 'error';

let currentTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, error = false): void {
  const root = document.getElementById('toast-root');
  if (!root) return;

  if (currentTimer) clearTimeout(currentTimer);

  const kind: ToastKind = error ? 'error' : 'info';
  const iconHtml = error ? icons.close : icons.check;

  root.innerHTML = `
    <div class="toast toast--${kind}" role="status" aria-live="polite">
      <span class="toast-icon">${iconHtml}</span>
      <span class="toast-text">${escHtml(message)}</span>
    </div>
  `;

  // Fuerza reflow para que la animación de entrada se dispare
  root.querySelector('.toast')?.getBoundingClientRect();

  currentTimer = setTimeout(() => {
    const toast = root.querySelector('.toast');
    if (toast) toast.classList.add('toast--out');
    setTimeout(() => { root.innerHTML = ''; }, 200);
  }, 3000);
}

function escHtml(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));
}
