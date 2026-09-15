/** Conecta a /api/admin/events y llama a onUpdate() cada vez que algo cambia. Cae a polling si SSE no conecta. */
export function connectEvents(onUpdate, { pollMs = 20000 } = {}) {
  let usingFallback = false;
  let pollTimer = null;

  const startFallback = () => {
    if (usingFallback) return;
    usingFallback = true;
    pollTimer = setInterval(onUpdate, pollMs);
  };

  try {
    const source = new EventSource('/api/admin/events');
    source.addEventListener('students-updated', () => onUpdate());
    source.onerror = () => {
      // EventSource reintenta solo; agregamos un respaldo de polling por si el navegador
      // o un proxy intermedio corta el stream silenciosamente.
      startFallback();
    };
    source.onopen = () => {
      usingFallback = false;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  } catch {
    startFallback();
  }

  // Respaldo de baja frecuencia siempre activo, por si el SSE se queda "conectado" pero mudo.
  setInterval(onUpdate, pollMs * 3);
}
