export class ApiError extends Error {}

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message || `Error ${res.status}`);
  return data;
}

export const api = {
  login: (user, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ user, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  session: () => request('/api/auth/session'),

  summary: () => request('/api/admin/summary'),
  listStudents: () => request('/api/admin/students'),
  addStudent: (id, group) => request('/api/admin/students', { method: 'POST', body: JSON.stringify({ id, group }) }),
  addBulk: (prefix, count, group) =>
    request('/api/admin/students', { method: 'POST', body: JSON.stringify({ prefix, count, group }) }),
  activate: (id) => request(`/api/admin/students/${encodeURIComponent(id)}/activate`, { method: 'POST' }),
  deactivate: (id) => request(`/api/admin/students/${encodeURIComponent(id)}/deactivate`, { method: 'POST' }),
  regeneratePassword: (id) =>
    request(`/api/admin/students/${encodeURIComponent(id)}/regenerate-password`, { method: 'POST' }),
  setGroup: (id, group) =>
    request(`/api/admin/students/${encodeURIComponent(id)}/group`, { method: 'POST', body: JSON.stringify({ group }) }),
  remove: (id) => request(`/api/admin/students/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  wipeData: (id) => request(`/api/admin/students/${encodeURIComponent(id)}/data`, { method: 'DELETE' }),
  logs: async (id) => {
    const res = await fetch(`/api/admin/students/${encodeURIComponent(id)}/logs`, { credentials: 'same-origin' });
    if (!res.ok) throw new ApiError(`No se pudieron obtener los logs (${res.status}).`);
    return res.text();
  },
  bulkAction: (action, ids) =>
    request(`/api/admin/students/bulk/${action}`, { method: 'POST', body: JSON.stringify({ ids }) }),
};
