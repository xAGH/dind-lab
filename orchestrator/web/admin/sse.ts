/**
 * Conecta a /api/admin/events y llama a onUpdate() cada vez que algo cambia.
 * Cae a polling si SSE no conecta o si un proxy corta el stream silenciosamente.
 */
export function connectEvents(onUpdate: () => void, { pollMs = 20_000 } = {}): void {
  let usingFallback = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const startFallback = () => {
    if (usingFallback) return;
    usingFallback = true;
    pollTimer = setInterval(onUpdate, pollMs);
  };

  try {
    const source = new EventSource('/api/admin/events');

    source.addEventListener('students-updated', () => onUpdate());

    source.onerror = () => {
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

  // Respaldo de baja frecuencia siempre activo, por si el SSE queda mudo
  setInterval(onUpdate, pollMs * 3);
}
