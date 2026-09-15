const root = document.getElementById('modal-root');

function close() {
  root.innerHTML = '';
}

function open(innerHtml, { wide = false } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${innerHtml}</div>`;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  root.innerHTML = '';
  root.appendChild(backdrop);
  return backdrop;
}

export function confirmModal(title, message, { danger = false, confirmLabel = 'Confirmar' } = {}) {
  return new Promise((resolve) => {
    const el = open(`
      <h2>${title}</h2>
      <p class="modal-subtitle">${message}</p>
      <div class="modal-actions">
        <button type="button" data-action="cancel">Cancelar</button>
        <button type="button" data-action="confirm" class="${danger ? 'danger' : 'primary'}">${confirmLabel}</button>
      </div>
    `);
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      close();
      resolve(false);
    });
    el.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      close();
      resolve(true);
    });
  });
}

export function addStudentModal() {
  return new Promise((resolve) => {
    const el = open(`
      <h2>Agregar aprendiz</h2>
      <p class="modal-subtitle">El id se usa en la URL: minusculas, numeros y guiones.</p>
      <form id="modal-form">
        <label for="f-id">Identificador</label>
        <input type="text" id="f-id" placeholder="jsuarez" required pattern="[a-z0-9][a-z0-9-]{1,30}" />
        <label for="f-group">Grupo (opcional)</label>
        <input type="text" id="f-group" placeholder="default" />
        <p class="error-text" id="modal-error"></p>
        <div class="modal-actions">
          <button type="button" data-action="cancel">Cancelar</button>
          <button type="submit" class="primary">Agregar</button>
        </div>
      </form>
    `);
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      close();
      resolve(null);
    });
    el.querySelector('#modal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = el.querySelector('#f-id').value.trim().toLowerCase();
      const group = el.querySelector('#f-group').value.trim() || 'default';
      close();
      resolve({ id, group });
    });
  });
}

export function bulkModal() {
  return new Promise((resolve) => {
    const el = open(`
      <h2>Generar en lote</h2>
      <p class="modal-subtitle">Crea varios aprendices con un prefijo numerado (ej. alumno1, alumno2…).</p>
      <form id="modal-form">
        <label for="f-count">Cantidad</label>
        <input type="text" id="f-count" inputmode="numeric" placeholder="25" required />
        <label for="f-prefix">Prefijo</label>
        <input type="text" id="f-prefix" value="alumno" required />
        <label for="f-group">Grupo (opcional)</label>
        <input type="text" id="f-group" placeholder="default" />
        <p class="error-text" id="modal-error"></p>
        <div class="modal-actions">
          <button type="button" data-action="cancel">Cancelar</button>
          <button type="submit" class="primary">Generar</button>
        </div>
      </form>
    `);
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      close();
      resolve(null);
    });
    el.querySelector('#modal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const count = parseInt(el.querySelector('#f-count').value, 10);
      const prefix = el.querySelector('#f-prefix').value.trim() || 'alumno';
      const group = el.querySelector('#f-group').value.trim() || 'default';
      const errorEl = el.querySelector('#modal-error');
      if (!count || count <= 0) {
        errorEl.textContent = 'Indica una cantidad valida.';
        return;
      }
      close();
      resolve({ count, prefix, group });
    });
  });
}

export function logsModal(id, logsText) {
  const el = open(`
    <h2>Logs de ${id}</h2>
    <p class="modal-subtitle">Ultimas 200 lineas</p>
    <pre>${logsText.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre>
    <div class="modal-actions">
      <button type="button" data-action="close" class="primary">Cerrar</button>
    </div>
  `, { wide: true });
  el.querySelector('[data-action="close"]').addEventListener('click', close);
}

export function closeModal() {
  close();
}
