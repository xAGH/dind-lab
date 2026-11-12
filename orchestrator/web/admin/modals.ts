import { icons } from './icons.js';

const root = document.getElementById('modal-root')!;

function escHtml(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));
}

function close(): void {
  const modal = root.querySelector('.modal');
  if (modal) modal.classList.add('modal--out');
  setTimeout(() => { root.innerHTML = ''; }, 150);
}

function openModal(innerHtml: string, wide = false): HTMLElement {
  root.innerHTML = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal${wide ? ' modal--wide' : ''}">${innerHtml}</div>`;

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  root.appendChild(backdrop);

  // Cierre con Escape
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  // Foco al primer input / botón dentro del modal
  requestAnimationFrame(() => {
    const first = backdrop.querySelector<HTMLElement>('input, button, [tabindex]');
    first?.focus();
  });

  return backdrop;
}

/* ---- Confirmación ---- */

export function confirmModal(
  title: string,
  message: string,
  { danger = false, confirmLabel = 'Confirmar' } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const el = openModal(`
      <div class="modal-header">
        <h2 class="modal-title">${escHtml(title)}</h2>
        <button type="button" class="btn btn--ghost btn--icon modal-close" aria-label="Cerrar">
          ${icons.close}
        </button>
      </div>
      <p class="modal-body">${escHtml(message)}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn--secondary" data-action="cancel">Cancelar</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-action="confirm">
          ${escHtml(confirmLabel)}
        </button>
      </div>
    `);

    el.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener('click', () => {
      close(); resolve(false);
    });
    el.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.addEventListener('click', () => {
      close(); resolve(true);
    });
    el.querySelector<HTMLButtonElement>('.modal-close')!.addEventListener('click', () => {
      close(); resolve(false);
    });
  });
}

/* ---- Agregar aprendiz ---- */

export function addStudentModal(): Promise<{ id: string; group: string } | null> {
  return new Promise((resolve) => {
    const el = openModal(`
      <div class="modal-header">
        <h2 class="modal-title">Agregar aprendiz</h2>
        <button type="button" class="btn btn--ghost btn--icon modal-close" aria-label="Cerrar">
          ${icons.close}
        </button>
      </div>
      <p class="modal-hint">El id aparece en la URL: solo minúsculas, números y guiones.</p>
      <form id="modal-form" novalidate>
        <div class="field">
          <label for="f-id">Identificador</label>
          <input type="text" id="f-id" class="mono" placeholder="jsuarez"
                 required pattern="[a-z0-9][a-z0-9-]{1,30}"
                 autocomplete="off" spellcheck="false" />
        </div>
        <div class="field">
          <label for="f-group">Grupo <span class="field-optional">(opcional)</span></label>
          <input type="text" id="f-group" placeholder="default" autocomplete="off" />
        </div>
        <p class="error-text" id="modal-error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn btn--secondary" data-action="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Agregar</button>
        </div>
      </form>
    `);

    el.querySelector<HTMLButtonElement>('.modal-close')!.addEventListener('click', () => {
      close(); resolve(null);
    });
    el.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener('click', () => {
      close(); resolve(null);
    });
    el.querySelector<HTMLFormElement>('#modal-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = (el.querySelector<HTMLInputElement>('#f-id')!.value ?? '').trim().toLowerCase();
      const group = (el.querySelector<HTMLInputElement>('#f-group')!.value ?? '').trim() || 'default';
      if (!id) {
        el.querySelector<HTMLElement>('#modal-error')!.textContent = 'El identificador no puede estar vacío.';
        return;
      }
      close();
      resolve({ id, group });
    });
  });
}

/* ---- Generar en lote ---- */

export function bulkModal(): Promise<{ prefix: string; count: number; group: string } | null> {
  return new Promise((resolve) => {
    const el = openModal(`
      <div class="modal-header">
        <h2 class="modal-title">Generar en lote</h2>
        <button type="button" class="btn btn--ghost btn--icon modal-close" aria-label="Cerrar">
          ${icons.close}
        </button>
      </div>
      <p class="modal-hint">Crea varios aprendices con un prefijo numerado (ej. alumno1, alumno2…).</p>
      <form id="modal-form" novalidate>
        <div class="field-row">
          <div class="field">
            <label for="f-count">Cantidad</label>
            <input type="text" id="f-count" class="mono" inputmode="numeric"
                   placeholder="25" required autocomplete="off" />
          </div>
          <div class="field field--grow">
            <label for="f-prefix">Prefijo</label>
            <input type="text" id="f-prefix" class="mono" value="alumno"
                   required autocomplete="off" />
          </div>
        </div>
        <div class="field">
          <label for="f-group">Grupo <span class="field-optional">(opcional)</span></label>
          <input type="text" id="f-group" placeholder="default" autocomplete="off" />
        </div>
        <p class="error-text" id="modal-error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn btn--secondary" data-action="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Generar</button>
        </div>
      </form>
    `);

    el.querySelector<HTMLButtonElement>('.modal-close')!.addEventListener('click', () => {
      close(); resolve(null);
    });
    el.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener('click', () => {
      close(); resolve(null);
    });
    el.querySelector<HTMLFormElement>('#modal-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const count = parseInt(el.querySelector<HTMLInputElement>('#f-count')!.value, 10);
      const prefix = (el.querySelector<HTMLInputElement>('#f-prefix')!.value ?? '').trim() || 'alumno';
      const group = (el.querySelector<HTMLInputElement>('#f-group')!.value ?? '').trim() || 'default';
      const errorEl = el.querySelector<HTMLElement>('#modal-error')!;
      if (!count || count <= 0 || count > 500) {
        errorEl.textContent = 'Indica una cantidad entre 1 y 500.';
        return;
      }
      close();
      resolve({ count, prefix, group });
    });
  });
}

/* ---- Visor de logs ---- */

export function logsModal(id: string, logsText: string): void {
  const el = openModal(`
    <div class="modal-header">
      <div>
        <h2 class="modal-title">Logs — <span class="mono">${escHtml(id)}</span></h2>
        <p class="modal-hint">Últimas 200 líneas</p>
      </div>
      <button type="button" class="btn btn--ghost btn--icon modal-close" aria-label="Cerrar">
        ${icons.close}
      </button>
    </div>
    <div class="logs-wrap">
      <pre class="logs-pre">${escHtml(logsText)}</pre>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn--primary" data-action="close">Cerrar</button>
    </div>
  `, true);

  el.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener('click', close);
  el.querySelector<HTMLButtonElement>('.modal-close')!.addEventListener('click', close);
}
