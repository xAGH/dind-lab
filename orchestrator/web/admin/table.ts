import type { Student, InstanceStatus } from '../types.js';
import { icons } from './icons.js';

const STATUS_LABEL: Record<InstanceStatus, string> = {
  activo:     'activo',
  inactivo:   'inactivo',
  iniciando:  'iniciando',
  deteniendo: 'deteniendo',
  error:      'error',
};

function escHtml(value: string): string {
  return String(value).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return '—';
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatUptime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function distinctGroups(students: Student[]): string[] {
  return [...new Set(students.map((s) => s.group || 'default'))].sort();
}

function statusCell(status: InstanceStatus): string {
  return `<span class="status-badge status-${status}"><span class="status-dot"></span>${STATUS_LABEL[status]}</span>`;
}

function statsCell(student: Student): string {
  const { stats } = student;
  if (!stats) return '<span class="cell-muted mono">—</span>';

  const pct = Math.min(100, Math.round((stats.memUsedMb / stats.memLimitMb) * 100));
  const barClass = pct >= 90 ? 'ram-crit' : pct >= 70 ? 'ram-warn' : '';
  const uptime = formatUptime(stats.uptimeSeconds);

  return `
    <div class="stats-cell">
      <span class="mono stat-cpu">${stats.cpuPercent.toFixed(0)}%</span>
      <div class="ram-bar" title="${stats.memUsedMb}/${stats.memLimitMb} MB">
        <div class="ram-fill ${barClass}" style="--pct:${pct}%"></div>
      </div>
      <span class="mono stat-mem">${stats.memUsedMb}<span class="cell-muted">/${stats.memLimitMb}mb</span></span>
      ${uptime ? `<span class="mono stat-uptime cell-muted">${uptime}</span>` : ''}
    </div>
  `;
}

function diskCell(student: Student): string {
  const { disk } = student;
  if (!disk) return '<span class="cell-muted mono">—</span>';
  const total = (disk.dataBytes ?? 0) + (disk.workBytes ?? 0);
  if (total <= 0) return '<span class="cell-muted mono">—</span>';
  return `<span class="mono" title="imágenes: ${formatBytes(disk.dataBytes)} · workspace: ${formatBytes(disk.workBytes)}">${formatBytes(total)}</span>`;
}

export function renderRow(student: Student, { selected }: { selected: boolean }): string {
  const isActive = student.status === 'activo';
  const isBusy = student.status === 'iniciando' || student.status === 'deteniendo';
  const isInactive = student.status === 'inactivo';

  const toggleLabel = isActive ? 'Apagar' : 'Encender';
  const accessCell = student.url
    ? `<a class="access-link" href="${student.url}" target="_blank" rel="noopener" title="Abrir terminal">
         ${icons.externalLink} abrir
       </a>`
    : `<span class="cell-muted">—</span>`;

  return `
    <tr data-row="${escHtml(student.id)}" class="${selected ? 'row--selected' : ''}">
      <td data-label="">
        <input type="checkbox" class="row-select" data-id="${escHtml(student.id)}"
               ${selected ? 'checked' : ''} aria-label="Seleccionar ${escHtml(student.id)}" />
      </td>
      <td data-label="Aprendiz" class="mono cell-id">${escHtml(student.id)}</td>
      <td data-label="Grupo">${escHtml(student.group || 'default')}</td>
      <td data-label="Estado">${statusCell(student.status)}</td>
      <td data-label="Acceso">${accessCell}</td>
      <td data-label="Clave">
        <div class="pw-cell">
          <span class="mono pw-text">${escHtml(student.password)}</span>
          <button class="btn btn--ghost btn--icon btn--xs pw-copy"
                  data-action="copy-password"
                  data-id="${escHtml(student.id)}"
                  data-password="${escHtml(student.password)}"
                  title="Copiar clave">
            ${icons.copy}
          </button>
        </div>
      </td>
      <td data-label="CPU · RAM">${statsCell(student)}</td>
      <td data-label="Disco">${diskCell(student)}</td>
      <td data-label="">
        <div class="row-actions">
          <label class="toggle-wrap" title="${toggleLabel}">
            <input type="checkbox" class="toggle sr-only"
                   data-id="${escHtml(student.id)}"
                   ${isActive ? 'checked' : ''}
                   ${isBusy ? 'disabled' : ''}
                   aria-label="${toggleLabel} ${escHtml(student.id)}" />
            <span class="toggle-track" aria-hidden="true">
              <span class="toggle-thumb"></span>
            </span>
          </label>
          <button class="btn btn--ghost btn--icon btn--xs"
                  data-action="logs" data-id="${escHtml(student.id)}"
                  title="Ver logs"
                  ${isInactive ? 'disabled' : ''}>
            ${icons.terminal}
          </button>
          <button class="btn btn--ghost btn--icon btn--xs"
                  data-action="regenerate" data-id="${escHtml(student.id)}"
                  title="Regenerar clave">
            ${icons.key}
          </button>
          <button class="btn btn--ghost btn--icon btn--xs btn--muted-danger"
                  data-action="wipe" data-id="${escHtml(student.id)}"
                  title="Borrar datos guardados"
                  ${isActive ? 'disabled' : ''}>
            ${icons.trash}
          </button>
          <button class="btn btn--ghost btn--icon btn--xs btn--danger"
                  data-action="delete" data-id="${escHtml(student.id)}"
                  title="Eliminar aprendiz">
            ${icons.close}
          </button>
        </div>
      </td>
    </tr>
  `;
}

export function renderTable(tbody: HTMLElement, students: Student[], selectedIds: Set<string>): void {
  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="table-empty">
          <div class="empty-state">
            <span class="empty-icon">${icons.users}</span>
            <p class="empty-title">Aún no hay aprendices</p>
            <p class="empty-hint">Usa "Agregar" o "Generar en lote" para crear la clase.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = [...students]
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((s) => renderRow(s, { selected: selectedIds.has(s.id) }))
    .join('');
}

export function renderSkeleton(tbody: HTMLElement, rows = 5): void {
  const skRow = `
    <tr class="skeleton-row">
      <td><span class="skel skel--16"></span></td>
      <td><span class="skel skel--80"></span></td>
      <td><span class="skel skel--56"></span></td>
      <td><span class="skel skel--64"></span></td>
      <td><span class="skel skel--40"></span></td>
      <td><span class="skel skel--72"></span></td>
      <td><span class="skel skel--96"></span></td>
      <td><span class="skel skel--48"></span></td>
      <td><span class="skel skel--80"></span></td>
    </tr>`;
  tbody.innerHTML = Array(rows).fill(skRow).join('');
}
