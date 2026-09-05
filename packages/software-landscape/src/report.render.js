/**
 * 3. report.render.js — CAPA DE PRESENTACIÓN
 */

import { escapeHtml } from '@shared/index.js';
import { CATEGORY_META, FUNCTIONAL_AREA_META, TAB_LABELS, ZONE_META } from './report.calc.js';

export function renderShell(model, activeTab) {
  return `
    <div class="slr">
      ${renderTopbar(activeTab)}
      <div class="slr-panel">
        ${activeTab === 'summary' ? renderSummary(model.summary) : renderLandscape(model.landscape)}
      </div>
    </div>
  `;
}

function renderTopbar(activeTab) {
  return `
    <div class="slr-topbar">
      <div class="slr-tabs">
        ${Object.entries(TAB_LABELS).map(([key, label]) => `
          <button class="slr-tab ${activeTab === key ? 'is-active' : ''}" data-tab="${key}">
            ${escapeHtml(label)}
          </button>
        `).join('')}
      </div>
      <div class="slr-topbar-actions">
        <div class="slr-cutoff">Corte ${formatMonthYear(new Date())}</div>
      </div>
    </div>
  `;
}

function renderSummary(summary) {
  return `
    <section class="slr-summary">
      <div class="slr-kpis">
        ${renderKpi('61', 'Aplicaciones', summary.counts.applications, 'application')}
        ${renderKpi('99', 'Aplicaciones y modulos', summary.counts.appModules, 'application')}
        ${renderKpi('48', 'Herramientas', summary.counts.tools, 'tool')}
        ${renderKpi('48', 'Componentes TI', summary.counts.components, 'component')}
        ${renderKpi('2', 'Plataformas', summary.counts.platforms, 'platform')}
      </div>
      <div class="slr-summary-grid">
        <div class="slr-card">
          <div class="slr-card-header">
            <h2>Distribucion del Landscape de Software</h2>
            <span class="slr-pill">${summary.counts.total}</span>
          </div>
          ${renderDistributionBars(summary.distribution)}
        </div>
        <div class="slr-card">
          <div class="slr-card-header">
            <h2>Distribucion del Landscape</h2>
            <span class="slr-pill">${summary.counts.total}</span>
          </div>
          ${renderDonut(summary.counts)}
        </div>
        <div class="slr-card">
          <div class="slr-card-header">
            <h2>Gobierno de Aplicaciones</h2>
            <span class="slr-pill">${summary.counts.applications}</span>
          </div>
          ${renderGovernance(summary.governance)}
        </div>
      </div>
    </section>
  `;
}

function renderKpi(referenceValue, label, actualValue, category) {
  const meta = CATEGORY_META[category];
  return `
    <div class="slr-kpi">
      <div class="slr-kpi-badge" style="background:${meta.color}">${actualValue}</div>
      <div>
        <div class="slr-kpi-label">${escapeHtml(label)}</div>
        <div class="slr-kpi-ref">Referencia fuente: ${escapeHtml(referenceValue)}</div>
      </div>
    </div>
  `;
}

function renderDistributionBars(rows) {
  const max = Math.max(...rows.map(row => row.total), 1);

  return `
    <div class="slr-legend">${renderCategoryLegend()}</div>
    <div class="slr-bars">
      ${rows.map(row => `
        <div class="slr-bar-row">
          <div class="slr-bar-label">${escapeHtml(row.society)}</div>
          <div class="slr-bar-stack">
            ${renderBarSegment(row.application, row.total, max, 'application')}
            ${renderBarSegment(row.component, row.total, max, 'component')}
            ${renderBarSegment(row.tool, row.total, max, 'tool')}
            ${renderBarSegment(row.platform, row.total, max, 'platform')}
          </div>
          <div class="slr-bar-total">${row.total}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBarSegment(value, total, max, category) {
  if (!value) return '';
  const meta = CATEGORY_META[category];
  const width = Math.max(6, Math.round((value / max) * 100));
  return `<span class="slr-segment" style="width:${width}%;background:${meta.color}" title="${meta.label}: ${value}">${value}</span>`;
}

function renderDonut(counts) {
  const values = [
    ['application', counts.applications],
    ['component', counts.components],
    ['tool', counts.tools],
    ['platform', counts.platforms],
  ];
  const total = values.reduce((sum, [, value]) => sum + value, 0) || 1;
  let start = 0;
  const gradient = values.map(([category, value]) => {
    const end = start + (value / total) * 360;
    const meta = CATEGORY_META[category];
    const segment = `${meta.color} ${start}deg ${end}deg`;
    start = end;
    return segment;
  }).join(', ');

  return `
    <div class="slr-donut-wrap">
      <div class="slr-donut" style="background:conic-gradient(${gradient})">
        <div class="slr-donut-hole">${counts.total}</div>
      </div>
      <div class="slr-donut-legend">${renderCategoryLegend(values)}</div>
    </div>
  `;
}

function renderGovernance(rows) {
  const total = rows.reduce((sum, row) => sum + row.total, 0) || 1;

  return `
    <div class="slr-gov-list">
      ${rows.map(row => `
        <div class="slr-gov-row">
          <div class="slr-gov-label">${escapeHtml(row.label)}</div>
          <div class="slr-gov-bar">
            <span class="slr-gov-fill" style="width:${Math.round((row.total / total) * 100)}%"></span>
          </div>
          <div class="slr-gov-value">${row.total}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLandscape(landscape) {
  const lateralZones = landscape.regionalZones.filter(zone => zone !== 'shadow' && zone !== 'pending');
  return `
    <section class="slr-landscape">
      <div class="slr-landscape-legend">${renderCategoryLegend()}</div>
      <div class="slr-board">
        ${renderMainLandscape(landscape)}
        <aside class="slr-regional">
          <h2>Otras sociedades</h2>
          <div class="slr-regional-grid">
            ${lateralZones.map(zone => renderZone(zone, landscape.zones[zone], true)).join('')}
          </div>
        </aside>
      </div>
    </section>
  `;
}

function renderMainLandscape(landscape) {
  const hasPending = (landscape.zones.pending || []).length > 0;
  return `
    <section class="slr-main-diagram">
      <div class="slr-main-title">Alicorp Peru</div>

      <div class="slr-top-grid">
        ${renderZone('commercial', landscape.zones.commercial)}
        ${renderZone('supply', landscape.zones.supply)}
        ${renderZone('finance', landscape.zones.finance)}
        ${renderZone('hr', landscape.zones.hr)}
      </div>

      ${renderSapIntersection(landscape.sapEcosystem)}

      ${renderZone('cross', landscape.zones.cross, false, 'slr-zone--cross')}
      ${renderZone('tools', landscape.zones.tools, false, 'slr-zone--tools')}
      <div class="slr-under-tools ${hasPending ? 'has-pending' : 'is-single'}">
        ${renderZone('shadow', landscape.zones.shadow, false, 'slr-zone--bottom slr-zone--shadow')}
        ${hasPending ? renderZone('pending', landscape.zones.pending, false, 'slr-zone--bottom slr-zone--pending') : ''}
      </div>
    </section>
  `;
}

function renderSapIntersection(rows) {
  const topRows = rows.filter(row => row.key !== 'cross' && row.key !== 'tools');
  const crossRow = rows.find(row => row.key === 'cross');
  const toolsRow = rows.find(row => row.key === 'tools');
  const hasContent = rows.some(row => row.groups.length);
  return `
    <section class="slr-sap-intersection">
      <div class="slr-sap-rail">Ecosistema SAP</div>
      <div class="slr-sap-band">
        ${hasContent
          ? topRows.map(row => `
            <div class="slr-sap-cell">
              <div class="slr-sap-cell-title">${escapeHtml(row.label)}</div>
              <div class="slr-zone-items">
                ${row.groups.length
                  ? row.groups.map(group => renderLandscapeCard(group)).join('')
                  : '<div class="slr-empty">Sin elementos</div>'}
              </div>
            </div>
          `).join('')
          : '<div class="slr-empty">Sin elementos del ecosistema SAP</div>'}
      </div>
      ${crossRow?.groups.length ? `
        <div class="slr-sap-cross">
          <div class="slr-sap-cell-title">${escapeHtml(crossRow.label)}</div>
          <div class="slr-zone-items">
            ${crossRow.groups.length
              ? crossRow.groups.map(group => renderLandscapeCard(group)).join('')
              : '<div class="slr-empty">Sin elementos</div>'}
          </div>
        </div>
      ` : ''}
      ${toolsRow?.groups.length ? `
        <div class="slr-sap-tools">
          <div class="slr-sap-cell-title">${escapeHtml(toolsRow.label)}</div>
          <div class="slr-zone-items">
            ${toolsRow.groups.length
              ? toolsRow.groups.map(group => renderLandscapeCard(group)).join('')
              : '<div class="slr-empty">Sin elementos</div>'}
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

function renderZone(zoneKey, groups, compact = false, extraClass = '') {
  const meta = ZONE_META[zoneKey];
  return `
    <section class="slr-zone ${compact ? 'slr-zone--compact' : ''} ${extraClass}">
      <div class="slr-zone-title">${escapeHtml(meta.label)}</div>
      <div class="slr-zone-items">
        ${groups.length
          ? groups.map(group => renderLandscapeCard(group)).join('')
          : '<div class="slr-empty">Sin elementos clasificados</div>'}
      </div>
    </section>
  `;
}

function renderLandscapeCard(group) {
  const meta = CATEGORY_META[group.assetCategory];
  const parentLabel = group.alignmentParents?.[0] ? `Padre TI: ${group.alignmentParents.join(', ')}` : '';
  const detail = parentLabel || (group.channels[0] ? `Canal: ${group.channels.join(', ')}` : meta.label);
  const functionalChip = group.functionalAreas?.[0] && FUNCTIONAL_AREA_META[group.functionalAreas[0]]
    ? `<span class="slr-item-chip">${escapeHtml(FUNCTIONAL_AREA_META[group.functionalAreas[0]])}</span>`
    : '';
  const itemIds = group.items.map(item => item.id).join(',');
  return `
    <article
      class="slr-item slr-item--${escapeHtml(group.assetCategory)}"
      style="--item-color:${meta.color}"
      title="${escapeHtml(detail)}"
      data-group-label="${escapeHtml(group.label)}"
      data-asset-category="${escapeHtml(group.assetCategory)}"
      data-item-ids="${escapeHtml(itemIds)}"
    >
      <div class="slr-item-title">${escapeHtml(group.label)}</div>
      ${functionalChip}
      ${group.badgeCount >= 2 ? `<span class="slr-item-count">${group.badgeCount}</span>` : ''}
    </article>
  `;
}

function renderCategoryLegend(values) {
  const rows = values || Object.keys(CATEGORY_META).map(category => [category, null]);
  return rows.map(([category, value]) => {
    const meta = CATEGORY_META[category];
    return `
      <span class="slr-legend-item">
        <span class="slr-legend-dot" style="background:${meta.color}"></span>
        ${escapeHtml(meta.label)}${value != null ? `, ${value}` : ''}
      </span>
    `;
  }).join('');
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' })
    .format(date)
    .replace('.', '')
    .toUpperCase();
}
