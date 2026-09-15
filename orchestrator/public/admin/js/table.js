const STATUS_LABELS = {
  activo: 'activo',
  inactivo: 'inactivo',
  iniciando: 'iniciando…',
  deteniendo: 'deteniendo…',
  error: 'error',
};

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || bytes < 0) return '—';
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function escapeHtml(value) {
  return String(value).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
}

export function distinctGroups(students) {
  return [...new Set(students.map((s) => s.group || 'default'))].sort();
}

function diskCell(disk) {
  if (!disk) return '<span class="meter">—</span>';
  const total = (disk.dataBytes ?? 0) + (disk.workBytes ?? 0);
  return `<span class="meter" title="imagenes: ${formatBytes(disk.dataBytes)} · workspace: ${formatBytes(disk.workBytes)}">${formatBytes(total)}</span>`;
}

function statsCell(stats) {
  if (!stats) return '<span class="meter">—</span>';
  return `<span class="meter">${stats.cpuPercent.toFixed(0)}% · ${stats.memUsedMb}/${stats.memLimitMb} MB · ${formatUptime(stats.uptimeSeconds)}</span>`;
}

export function renderRow(student, { selected }) {
  const isActive = student.status === 'activo';
  const isBusy = student.status === 'iniciando' || student.status === 'deteniendo';

  return `
    <tr data-row="${student.id}">
      <td><input type="checkbox" class="row-select" data-id="${student.id}" ${selected ? 'checked' : ''} /></td>
      <td class="mono">${escapeHtml(student.id)}</td>
      <td>${escapeHtml(student.group || 'default')}</td>
      <td><span class="badge ${student.status}">${STATUS_LABELS[student.status] ?? student.status}</span></td>
      <td>${
        student.url
          ? `<a class="link" href="${student.url}" target="_blank" rel="noopener">abrir ↗</a>`
          : '<span class="meter">—</span>'
      }</td>
      <td><span class="pw mono" data-action="copy-password" data-id="${student.id}" data-password="${escapeHtml(student.password)}" title="Clic para copiar">${escapeHtml(student.password)}</span></td>
      <td>${statsCell(student.stats)}</td>
      <td>${diskCell(student.disk)}</td>
      <td>
        <div class="row-actions">
          <label class="switch" title="${isActive ? 'Apagar' : 'Encender'}">
            <input type="checkbox" class="toggle" data-id="${student.id}" ${isActive ? 'checked' : ''} ${isBusy ? 'disabled' : ''} />
            <span class="slider"></span>
          </label>
          <button class="icon-btn" data-action="logs" data-id="${student.id}" title="Ver logs" ${!student.url && student.status === 'inactivo' ? 'disabled' : ''}>📜</button>
          <button class="icon-btn" data-action="regenerate" data-id="${student.id}" title="Regenerar clave">🔑</button>
          <button class="icon-btn" data-action="wipe" data-id="${student.id}" title="Borrar datos guardados" ${isActive ? 'disabled' : ''}>🗑️</button>
          <button class="icon-btn" data-action="delete" data-id="${student.id}" title="Eliminar aprendiz">✕</button>
        </div>
      </td>
    </tr>
  `;
}

export function renderTable(tbody, students, selectedIds) {
  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">Aun no hay aprendices. Agrega el primero.</td></tr>';
    return;
  }
  tbody.innerHTML = students
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((s) => renderRow(s, { selected: selectedIds.has(s.id) }))
    .join('');
}
