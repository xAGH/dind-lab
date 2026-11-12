/**
 * Sistema de iconos SVG — 16×16, stroke-width 1.5, Lucide-style.
 * No usar emoji ni glifos Unicode como sustitutos.
 */

function icon(paths: string): string {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const icons = {
  // Navegación / acciones globales
  logout: icon(
    '<path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>' +
    '<path d="M10.5 11l3.5-3-3.5-3"/>' +
    '<path d="M6 8h8"/>',
  ),

  printer: icon(
    '<path d="M5 5V2h6v3"/>' +
    '<rect x="1" y="5" width="14" height="7" rx="1.5"/>' +
    '<path d="M4 12v2h8v-2"/>' +
    '<circle cx="12.5" cy="8.5" r=".75" fill="currentColor" stroke="none"/>',
  ),

  download: icon(
    '<path d="M8 2v8"/>' +
    '<path d="M5 7l3 3 3-3"/>' +
    '<path d="M2 13h12"/>',
  ),

  refresh: icon(
    '<path d="M2 8a6 6 0 1 0 1-3.46"/>' +
    '<path d="M2 2v4h4"/>',
  ),

  plus: icon('<path d="M8 3v10M3 8h10"/>'),

  users: icon(
    '<circle cx="6" cy="5" r="2.5"/>' +
    '<path d="M2 14c0-2.76 1.79-5 4-5s4 2.24 4 5"/>' +
    '<path d="M11 3c1.1 0 2 .9 2 2s-.9 2-2 2"/>' +
    '<path d="M14 14c0-2.21-1.34-4-3-4"/>',
  ),

  close: icon('<path d="M3 3l10 10M13 3L3 13"/>'),

  check: icon('<path d="M2 8l4 4 8-8"/>'),

  // Tabla — acciones por fila
  externalLink: icon(
    '<path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9"/>' +
    '<path d="M9 2h5v5"/>' +
    '<path d="M14 2L7.5 8.5"/>',
  ),

  terminal: icon(
    '<rect x="1" y="2" width="14" height="12" rx="2"/>' +
    '<path d="M4 7l3 2.5L4 12"/>' +
    '<path d="M9 12h3"/>',
  ),

  key: icon(
    '<circle cx="6" cy="6" r="3.5"/>' +
    '<path d="M9.5 6H15"/>' +
    '<path d="M13 6v2"/>' +
    '<path d="M11 6v1.5"/>',
  ),

  trash: icon(
    '<path d="M2 4h12"/>' +
    '<path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>' +
    '<path d="M4 4l.75 9a1 1 0 0 0 1 .9h4.5a1 1 0 0 0 1-.9L12 4"/>',
  ),

  copy: icon(
    '<rect x="5" y="4" width="8" height="10" rx="1"/>' +
    '<path d="M5 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2"/>',
  ),

  // Power on/off (toggle accessibility label support)
  power: icon(
    '<path d="M8 2v5"/>' +
    '<path d="M5 4.3A6 6 0 1 0 11 4.3"/>',
  ),
} as const;
