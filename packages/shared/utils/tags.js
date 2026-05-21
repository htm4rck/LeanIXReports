import { escapeHtml } from './helpers.js';

export const TAG_COLORS = {
  'DTO': { bg: '#fef3c7', color: '#92400e' },
  'Marketing': { bg: '#fce7f3', color: '#9d174d' },
  'OTC': { bg: '#dbeafe', color: '#1e40af' },
  'AS - Alicorp Soluciones': { bg: '#d1fae5', color: '#065f46' },
  'No Tradicional': { bg: '#ede9fe', color: '#5b21b6' },
  'CMP - Consumo Masivo de Productos': { bg: '#ffedd5', color: '#9a3412' },
  'Tradicional Vertical': { bg: '#e0e7ff', color: '#3730a3' },
  'FTP': { bg: '#cffafe', color: '#155e75' },
  'Supply': { bg: '#ecfccb', color: '#3f6212' },
  'PTM': { bg: '#fae8ff', color: '#86198f' },
  'PTP': { bg: '#f0fdf4', color: '#166534' },
  'PTD': { bg: '#fff7ed', color: '#9a3412' },
  'MAI': { bg: '#f1f5f9', color: '#334155' },
  'Finanzas': { bg: '#fef9c3', color: '#854d0e' },
  'TI': { bg: '#e0f2fe', color: '#0c4a6e' },
  'RRHH': { bg: '#fecdd3', color: '#9f1239' },
  'Transversal-General': { bg: '#f5f5f4', color: '#44403c' },
};

export function getTagColor(tagName) {
  return TAG_COLORS[tagName] || { bg: '#f3f4f6', color: '#374151' };
}

export function renderTags(tags) {
  if (!tags || tags.length === 0) return '';
  return `<div class="tag-container">
    ${tags.map(t => {
      const c = getTagColor(t.name);
      return `<span class="tag-chip" style="background:${c.bg};color:${c.color}">${escapeHtml(t.name)}</span>`;
    }).join('')}
  </div>`;
}
