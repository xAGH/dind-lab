type Level = 'info' | 'warn' | 'error' | 'debug';

function line(level: Level, scope: string, message: string, extra?: unknown): void {
  const ts = new Date().toISOString();
  const payload = extra !== undefined ? ` ${safeStringify(extra)}` : '';
  const out = `${ts} [${level.toUpperCase()}] [${scope}] ${message}${payload}`;
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function createLogger(scope: string) {
  return {
    info: (message: string, extra?: unknown) => line('info', scope, message, extra),
    warn: (message: string, extra?: unknown) => line('warn', scope, message, extra),
    error: (message: string, extra?: unknown) => line('error', scope, message, extra),
    debug: (message: string, extra?: unknown) => {
      if (process.env.NODE_ENV !== 'production') line('debug', scope, message, extra);
    },
  };
}
