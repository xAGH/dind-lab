import type { Student, Summary, BulkResult } from '../types.js';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  if (res.status === 204) return null as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { message?: string }).message ?? `Error ${res.status}`, res.status);
  return data as T;
}

export const api = {
  // Auth
  login: (user: string, password: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ user, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  session: (): Promise<{ authenticated: boolean }> => request('/api/auth/session'),

  // Admin — resumen
  summary: (): Promise<Summary> => request('/api/admin/summary'),

  // Admin — aprendices
  listStudents: (): Promise<Student[]> => request('/api/admin/students'),

  addStudent: (id: string, group: string): Promise<Student> =>
    request('/api/admin/students', { method: 'POST', body: JSON.stringify({ id, group }) }),

  addBulk: (prefix: string, count: number, group: string): Promise<Student[]> =>
    request('/api/admin/students', { method: 'POST', body: JSON.stringify({ prefix, count, group }) }),

  activate: (id: string): Promise<Student> =>
    request(`/api/admin/students/${encodeURIComponent(id)}/activate`, { method: 'POST' }),

  deactivate: (id: string): Promise<Student> =>
    request(`/api/admin/students/${encodeURIComponent(id)}/deactivate`, { method: 'POST' }),

  regeneratePassword: (id: string): Promise<Student> =>
    request(`/api/admin/students/${encodeURIComponent(id)}/regenerate-password`, { method: 'POST' }),

  setGroup: (id: string, group: string): Promise<Student> =>
    request(`/api/admin/students/${encodeURIComponent(id)}/group`, {
      method: 'POST',
      body: JSON.stringify({ group }),
    }),

  remove: (id: string) =>
    request(`/api/admin/students/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  wipeData: (id: string) =>
    request(`/api/admin/students/${encodeURIComponent(id)}/data`, { method: 'DELETE' }),

  logs: async (id: string): Promise<string> => {
    const res = await fetch(`/api/admin/students/${encodeURIComponent(id)}/logs`, {
      credentials: 'same-origin',
    });
    if (!res.ok) throw new ApiError(`No se pudieron obtener los logs (${res.status}).`, res.status);
    return res.text();
  },

  bulkAction: (action: 'activate' | 'deactivate', ids: string[]): Promise<BulkResult> =>
    request(`/api/admin/students/bulk/${action}`, { method: 'POST', body: JSON.stringify({ ids }) }),
};
