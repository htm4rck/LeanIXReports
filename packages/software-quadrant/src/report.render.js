/**
 * report.render.js — CAPA DE PRESENTACIÓN
 */

import { escapeHtml } from '@shared/index.js';
import {
  BENCHMARK, QUARTILE_COLORS, QUADRANT_META,
  getQuartileColor, getQuartileLabel, getRiskLevel,
  getBreaches, getRecommendation, getQuadrantCounts,
  getPortfolioKPIs, getTopCritical,
} from './report.calc.js';

export function renderShell(apps, filters) {
  const kpis   = getPortfolioKPIs(apps);
  const counts = getQuadrantCounts(apps);
  const top    = getTopCritical(apps, 10);

  return `
    <div class="sq">
      ${renderHeader(kpis, filters)}
      ${renderFilterBar(apps, filters)}
      <div class="sq-body">
        ${renderQuadrant()}
        ${renderSidebar(counts, kpis.total)}
      </div>
      ${renderPriorityTable(top)}
      ${renderFooter()}
    </div>`;
}

export function renderTooltip(app) {
  const risk = getRiskLevel(app.agility, app.resilience);
  return `
    <div class="sq-tt-name">${escapeHtml(app.name)}</div>
    <div class="sq-tt-row"><span>Agilidad</span><strong>${app.agility}</strong></div>
    <div class="sq-tt-row"><span>Resiliencia</span><strong>${app.resilience}</strong></div>
    <div class="sq-tt-risk" style="color:${risk.color}">${risk.label} riesgo</div>`;
}

export function renderDetailPanel(app) {
  const risk       = getRiskLevel(app.agility, app.resilience);
  const breaches   = getBreaches(app);
  const rec        = getRecommendation(app.agility, app.resilience);
  const qLabel     = getQuartileLabel(app.agility, app.resilience);
  const qColor     = getQuartileColor(app.agility, app.resilience);

  return `
    <div class="sq-detail-header">
      <span class="sq-detail-risk-dot" style="background:${qColor}"></span>
      <span class="sq-detail-appname">${escapeHtml(app.name)}</span>
      <span class="sq-detail-badge" style="background:${risk.color}">${risk.label.toUpperCase()}</span>
    </div>

    <div class="sq-detail-scores">
      <div class="sq-detail-score-card">
        <span>Agilidad</span>
        <strong style="color:${app.agility < 50 ? '#ef4444' : '#22c55e'}">${app.agility}</strong>
        <small>/ 100</small>
      </div>
      <div class="sq-detail-score-card">
        <span>Resiliencia</span>
        <strong style="color:${app.resilience < 50 ? '#ef4444' : '#22c55e'}">${app.resilience}</strong>
        <small>/ 100</small>
      </div>
    </div>

    <div class="sq-detail-meta">
      <div><span>Estado / Cuartil</span><b>${escapeHtml(qLabel)}</b></div>
      <div><span>Dominio</span><b>${escapeHtml(app.domain)}</b></div>
      ${app.TipoAplicacion     ? `<div><span>Tipo de aplicación</span><b>${escapeHtml(app.TipoAplicacion)}</b></div>` : ''}
      ${app.criticidadDeDatos  ? `<div><span>Criticidad de datos</span><b>${escapeHtml(app.criticidadDeDatos)}</b></div>` : ''}
      ${app.businessCriticality ? `<div><span>Criticidad de negocio</span><b>${escapeHtml({ missionCritical:'Misión crítica', businessCritical:'Crítica de negocio', businessOperational:'Operacional', administrativeService:'Administrativa' }[app.businessCriticality] ?? app.businessCriticality)}</b></div>` : ''}
      ${app.TipoDeArquitectura  ? `<div><span>Arquitectura</span><b>${escapeHtml(app.TipoDeArquitectura)}</b></div>` : ''}
      ${app.lxHostingType      ? `<div><span>Hosting</span><b>${escapeHtml(app.lxHostingType)}</b></div>` : ''}
      ${app.lifecycle?.currentPhase ? `<div><span>Lifecycle</span><b>${escapeHtml(app.lifecycle.currentPhase)}</b></div>` : ''}
    </div>

    ${breaches.length ? `
    <div class="sq-detail-section-title">Brechas principales</div>
    <ul class="sq-detail-breaches">
      ${breaches.map(b => `
        <li>
          <span class="sq-breach-dot"></span>
          <span class="sq-breach-content">
            <span class="sq-breach-text">${escapeHtml(b.text)}</span>
            <span class="sq-breach-source">${escapeHtml(b.source)}</span>
          </span>
        </li>`).join('')}
    </ul>` : ''}

    <div class="sq-detail-section-title">Recomendación</div>
    <div class="sq-detail-rec">${escapeHtml(rec)}</div>`;
}

// ─── Secciones privadas ───────────────────────────────────────────────────────

function renderHeader(kpis, filters) {
  const agilityDelta    = kpis.avgAgility    - BENCHMARK.agility;
  const resilienceDelta = kpis.avgResilience - BENCHMARK.resilience;
  const healthyPct  = kpis.total ? Math.round(kpis.healthy  / kpis.total * 100) : 0;
  const criticalPct = kpis.total ? Math.round(kpis.critical / kpis.total * 100) : 0;

  const deltaArrow = (d) => d > 0 ? `↑ ${d}` : d < 0 ? `↓ ${Math.abs(d)}` : '=';
  const deltaClass = (d) => d > 0 ? 'sq-delta--up' : d < 0 ? 'sq-delta--down' : 'sq-delta--eq';

  // Gauge SVG para score general
  const score = kpis.overallScore;
  const gaugeColor = score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const r = 28, cx = 36, cy = 36, circ = Math.PI * r;
  const dash = (score / 100) * circ;

  return `
    <header class="sq-header">
      <div class="sq-header-left">
        <h1 class="sq-title">Salud del Portafolio de Aplicaciones</h1>
        <p class="sq-subtitle">Agilidad, resiliencia y prioridades de modernización</p>
        <div class="sq-last-eval">📅 Última evaluación: ${new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })}</div>
      </div>

      <div class="sq-kpi-cards">

        <div class="sq-kpi-card sq-kpi-card--agility">
          <div class="sq-kpi-label">AGILIDAD PROMEDIO</div>
          <div class="sq-kpi-value">${kpis.avgAgility}</div>
          <div class="sq-delta ${deltaClass(agilityDelta)}">${deltaArrow(agilityDelta)} vs Benchmark (${BENCHMARK.agility})</div>
        </div>

        <div class="sq-kpi-card sq-kpi-card--resilience">
          <div class="sq-kpi-label">RESILIENCIA PROMEDIO</div>
          <div class="sq-kpi-value">${kpis.avgResilience}</div>
          <div class="sq-delta ${deltaClass(resilienceDelta)}">${deltaArrow(resilienceDelta)} vs Benchmark (${BENCHMARK.resilience})</div>
        </div>

        <div class="sq-kpi-card sq-kpi-card--healthy">
          <div class="sq-kpi-label">APLICACIONES SALUDABLES</div>
          <div class="sq-kpi-value-frac">${kpis.healthy} <span>/ ${kpis.total}</span></div>
          <div class="sq-kpi-pct">${healthyPct}% del portafolio</div>
          <div class="sq-kpi-sub">Agilidad ≥50 y Resiliencia ≥50</div>
          <div class="sq-kpi-bar"><div class="sq-kpi-bar-fill sq-kpi-bar-fill--green" style="width:${healthyPct}%"></div></div>
        </div>

        <div class="sq-kpi-card sq-kpi-card--critical">
          <div class="sq-kpi-label">APLICACIONES EVALUAR</div>
          <div class="sq-kpi-value-frac">${kpis.critical} <span>/ ${kpis.total}</span></div>
          <div class="sq-kpi-pct">${criticalPct}% del portafolio</div>
          <div class="sq-kpi-sub">Criticidad de datos: Significativo+</div>
          <div class="sq-kpi-bar"><div class="sq-kpi-bar-fill sq-kpi-bar-fill--red" style="width:${criticalPct}%"></div></div>
        </div>

        <div class="sq-kpi-card sq-kpi-card--overall">
          <div class="sq-kpi-label">EVALUACIÓN GENERAL</div>
          <svg class="sq-gauge" viewBox="0 0 72 72">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="7"
              stroke-dasharray="${circ}" stroke-dashoffset="0"
              transform="rotate(-180 ${cx} ${cy})"/>
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${gaugeColor}" stroke-width="7"
              stroke-dasharray="${dash} ${circ - dash}" stroke-linecap="round"
              transform="rotate(-180 ${cx} ${cy})"/>
            <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="800" fill="#1e293b">${score}</text>
          </svg>
          <div class="sq-kpi-pct">Salud del portafolio</div>
        </div>

      </div>
    </header>`;
}

function renderFilterBar(apps, filters) {
  const domains = [...new Set(apps.map(a => a.domain))].sort();
  const types   = [...new Set(apps.map(a => a.TipoAplicacion).filter(Boolean))].sort();

  return `
    <div class="sq-filterbar">
      <div class="sq-filter-group">
        <span class="sq-filter-icon">🏢</span>
        <div class="sq-filter-wrap">
          <label>Dominio</label>
          <select id="sqFilterDomain" class="sq-select">
            <option value="">Todos</option>
            ${domains.map(d => `<option value="${escapeHtml(d)}" ${filters.domain === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="sq-filter-group">
        <span class="sq-filter-icon">🗂️</span>
        <div class="sq-filter-wrap">
          <label>Tipo de aplicación</label>
          <select id="sqFilterType" class="sq-select">
            <option value="">Todos</option>
            ${types.map(t => `<option value="${escapeHtml(t)}" ${filters.type === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="sq-filter-group">
        <span class="sq-filter-icon">🎯</span>
        <div class="sq-filter-wrap">
          <label>Cuartil / Estado</label>
          <select id="sqFilterQuartile" class="sq-select">
            <option value="">Todos</option>
            <option value="topRight"    ${filters.quartile === 'topRight'    ? 'selected' : ''}>Cuartil superior (Saludables)</option>
            <option value="topLeft"     ${filters.quartile === 'topLeft'     ? 'selected' : ''}>3er cuartil (En progreso)</option>
            <option value="bottomRight" ${filters.quartile === 'bottomRight' ? 'selected' : ''}>2do cuartil (Atención)</option>
            <option value="bottomLeft"  ${filters.quartile === 'bottomLeft'  ? 'selected' : ''}>Cuartil inferior (Evaluar)</option>
          </select>
        </div>
      </div>
      <div class="sq-filter-search">
        <span class="sq-filter-icon">🔍</span>
        <input id="sqFilterSearch" type="text" class="sq-search-input" placeholder="Buscar aplicación..." value="${escapeHtml(filters.search || '')}">
      </div>
      <button id="sqClearFilters" class="sq-btn-clear">↺ Limpiar filtros</button>
    </div>`;
}

function renderQuadrant() {
  return `
    <section class="sq-quadrant">
      <div class="sq-axis-y-label">RESILIENCIA ↑</div>
      <div class="sq-canvas-wrap">
        <canvas id="sqCanvas"></canvas>
        <div class="sq-tooltip" id="sqTooltip" hidden></div>
      </div>
      <div class="sq-axis-x-label">AGILIDAD →</div>
      <div class="sq-chart-legend">
        <div class="sq-legend-size">
          <span class="sq-legend-size-title">Tamaño = criticidadDeDatos:</span>
          <span class="sq-legend-size-item"><svg width="10" height="10"><circle cx="5" cy="5" r="3" fill="#94a3b8"/></svg> Bajo</span>
          <span class="sq-legend-size-item"><svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="#94a3b8"/></svg> Moderado</span>
          <span class="sq-legend-size-item"><svg width="18" height="18"><circle cx="9" cy="9" r="7" fill="#94a3b8"/></svg> Significativo</span>
          <span class="sq-legend-size-item"><svg width="22" height="22"><circle cx="11" cy="11" r="9" fill="#94a3b8"/></svg> MuySignificativo</span>
        </div>
        <div class="sq-legend-colors">
          <span class="sq-legend-color-title">Estado / Cuartil:</span>
          <span class="sq-legend-color-item"><svg width="10" height="10"><circle cx="5" cy="5" r="5" fill="${QUARTILE_COLORS[0]}"/></svg> Crítico (Cuartil inferior)</span>
          <span class="sq-legend-color-item"><svg width="10" height="10"><circle cx="5" cy="5" r="5" fill="${QUARTILE_COLORS[1]}"/></svg> Atención (2do cuartil)</span>
          <span class="sq-legend-color-item"><svg width="10" height="10"><circle cx="5" cy="5" r="5" fill="${QUARTILE_COLORS[2]}"/></svg> En progreso (3er cuartil)</span>
          <span class="sq-legend-color-item"><svg width="10" height="10"><circle cx="5" cy="5" r="5" fill="${QUARTILE_COLORS[3]}"/></svg> Saludable (Cuartil superior)</span>
        </div>
      </div>
    </section>`;
}

function renderSidebar(counts, total) {
  const pct = n => total ? Math.round(n / total * 100) : 0;
  const rows = [
    { key: 'topRight',    label: 'Cuartil superior (Saludables)', color: QUARTILE_COLORS[3], count: counts.topRight    },
    { key: 'topLeft',     label: '3er cuartil (En progreso)',      color: QUARTILE_COLORS[2], count: counts.topLeft     },
    { key: 'bottomRight', label: '2do cuartil (Atención)',         color: QUARTILE_COLORS[1], count: counts.bottomRight },
    { key: 'bottomLeft',  label: 'Cuartil inferior (Evaluar Riesgo)',    color: QUARTILE_COLORS[0], count: counts.bottomLeft  },
  ];

  return `
    <aside class="sq-sidebar">
      <div class="sq-sidebar-block">
        <div class="sq-sidebar-title">DISTRIBUCIÓN POR CUARTIL <span class="sq-sidebar-hint">ⓘ</span></div>
        ${rows.map(r => `
          <div class="sq-dist-row" data-quartile="${r.key}" title="Clic para filtrar">
            <span class="sq-dist-dot" style="background:${r.color}"></span>
            <span class="sq-dist-label">${r.label}</span>
            <strong class="sq-dist-count" style="color:${r.color}">${r.count}</strong>
            <span class="sq-dist-pct">${pct(r.count)}%</span>
          </div>`).join('')}
        <div class="sq-dist-total">Total aplicaciones: <strong>${total}</strong></div>
      </div>

      <div class="sq-sidebar-block">
        <div class="sq-sidebar-title">ACCIONES RÁPIDAS</div>
        <div class="sq-action-row" data-action="critical"><span class="sq-action-icon">🔴</span> Ver solo En Evaluación de Riesgo <strong>${counts.bottomLeft}</strong></div>
        <div class="sq-action-row" data-action="domain"><span class="sq-action-icon">🏢</span> Ver por dominio</div>
        <div class="sq-action-row" data-action="export"><span class="sq-action-icon">📊</span> Exportar reporte</div>
        <div class="sq-action-row" data-action="method"><span class="sq-action-icon">ℹ️</span> Metodología de evaluación</div>
      </div>

      <div class="sq-sidebar-block sq-sidebar-detail" id="sqDetail">
        <div class="sq-sidebar-title">APLICACIÓN SELECCIONADA <span id="sqDetailClose" class="sq-detail-close" hidden>✕</span></div>
        <p class="sq-detail-empty">Haz clic en una burbuja para ver el detalle</p>
      </div>
    </aside>`;
}

function renderPriorityTable(apps) {
  if (!apps.length) return '';
  const riskBadge = (app) => {
    const r = getRiskLevel(app.agility, app.resilience);
    return `<span class="sq-risk-badge" style="background:${r.color}">${r.label}</span>`;
  };
  const rec = (app) => {
    const r = getRecommendation(app.agility, app.resilience);
    return r.split('.')[0]; // solo primera oración
  };

  return `
    <section class="sq-priority-table">
      <div class="sq-table-header">
        <h2 class="sq-table-title">TOP APLICACIONES A INTERVENIR</h2>
      </div>
      <table class="sq-table">
        <thead>
          <tr>
            <th>Prioridad</th>
            <th>Aplicación</th>
            <th>Dominio</th>
            <th>Tipo</th>
            <th>Agilidad</th>
            <th>Resiliencia</th>
            <th>Estado</th>
            <th>Riesgo</th>
            <th>Recomendación</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${apps.map((app, i) => `
            <tr class="sq-table-row" data-id="${escapeHtml(app.id)}">
              <td><span class="sq-priority-num">${i + 1}</span></td>
              <td class="sq-table-appname">${escapeHtml(app.name)}</td>
              <td>${escapeHtml(app.domain)}</td>
              <td>${escapeHtml(app.TipoAplicacion || '—')}</td>
              <td><span class="sq-score-cell sq-score-cell--${app.agility < 50 ? 'bad' : 'ok'}">${app.agility}</span></td>
              <td><span class="sq-score-cell sq-score-cell--${app.resilience < 50 ? 'bad' : 'ok'}">${app.resilience}</span></td>
              <td>${escapeHtml(getQuartileLabel(app.agility, app.resilience))}</td>
              <td>${riskBadge(app)}</td>
              <td class="sq-table-rec">${escapeHtml(rec(app))}</td>
              <td><button class="sq-btn-detail" data-id="${escapeHtml(app.id)}">Ver detalle</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

function renderFooter() {
  return `
    <footer class="sq-footer">
      <span>
        <strong>Agilidad</strong> = technicalSuitability + bonus arquitectura &nbsp;|
        <strong>Resiliencia</strong> = lifecycle + bonus hosting + bonus RTO &nbsp;|
        <strong>Tamaño burbuja</strong> = criticidadDeDatos (campo LeanIX) &nbsp;|
        <strong>Críticas</strong> = criticidadDeDatos Significativo o MuySignificativo
      </span>
      <span>Benchmark: CAST AIP (Agilidad ${BENCHMARK.agility} · Resiliencia ${BENCHMARK.resilience})</span>
    </footer>`;
}
