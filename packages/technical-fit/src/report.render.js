import { escapeHtml } from '@shared/index.js';
import { COLORS, LABELS } from './report.calc.js';

export function renderShell({ total, evaluated, notEvaluable, coverage, counts }, sortedDomains, findings, apps) {
  return `
    <div class="tfit">
      <div class="tfit-header">
        <h1>Technical Fit — Evaluación automática del portafolio</h1>
        <div class="tfit-badges"><span class="tfit-badge">Resultado automático</span></div>
        <button class="tfit-info-btn" id="tfitInfoBtn" title="Ver metodología">ℹ</button>
      </div>

      ${renderMethodologyModal()}

      <div class="tfit-layout">
        <div class="tfit-main">
          <div class="tfit-top">
            ${renderKpiApps(total)}
            ${renderKpiCoverage(coverage, evaluated, total)}
            ${renderDonutCard(counts, notEvaluable, total)}
          </div>
          <div class="tfit-domains">
            <div class="tfit-domains-header">
              <h2>Technical Fit por dominio</h2>
              ${renderDomainsLegend()}
            </div>
            ${sortedDomains.map(([name, d]) => renderDomainBar(name, d)).join('')}
          </div>
          <div class="tfit-bottom">
            ${renderFindings(findings)}
            ${renderNextSteps()}
          </div>
          <div class="tfit-footer">Modelo v1.0 · Datos del inventario LeanIX · Resultado sujeto a nivel de completitud</div>
        </div>

        <div class="tfit-sidebar">
          <div class="tfit-detail-panel" id="tfitDetail">
            <div class="tfit-detail-empty">Selecciona una aplicación</div>
          </div>
          <div class="tfit-app-list" id="tfitAppList">
            <input type="text" id="tfitSearch" class="tfit-search" placeholder="Buscar aplicación...">
            <div class="tfit-app-table" id="tfitTable">${renderAppTable(apps)}</div>
          </div>
        </div>
      </div>
    </div>`;
}

export function renderAppTable(apps) {
  const sorted = [...apps].sort((a, b) => (b.score || 0) - (a.score || 0));
  return `<table><thead><tr><th>Aplicación</th><th>Dominio</th><th>Score</th><th>Rating</th></tr></thead><tbody>
    ${sorted.map(a => `<tr class="tfit-app-row" data-id="${a.id}">
      <td>${escapeHtml(a.name)}</td>
      <td>${escapeHtml(a.domain)}</td>
      <td>${a.score != null ? a.score.toFixed(2) : '—'}</td>
      <td><span class="tfit-rating-chip" style="background:${COLORS[a.rating] || COLORS.unreasonable}">${LABELS[a.rating] || 'No evaluable'}</span></td>
    </tr>`).join('')}
  </tbody></table>`;
}

export function renderDetail(app) {
  const criteriaLabels = {
    lifecycle: 'Lifecycle (30%)', architecture: 'Arquitectura (20%)',
    authentication: 'Autenticación (15%)', hosting: 'Hosting (10%)',
    availability: 'Disponibilidad / RTO (15%)', compliance: 'Compliance (10%)',
  };
  const criteriaColors = { 4: COLORS.fullyAppropriate, 3: COLORS.adequate, 2: COLORS.inappropriate, 1: COLORS.unreasonable };

  return `
    <div class="tfit-detail-name">${escapeHtml(app.name)}</div>
    <div class="tfit-detail-score" style="background:${COLORS[app.rating] || COLORS.unreasonable}">
      ${app.score != null ? app.score.toFixed(2) : '—'} · ${LABELS[app.rating] || 'No evaluable'}
    </div>
    <div class="tfit-detail-title">Contribución por criterio</div>
    ${Object.entries(criteriaLabels).map(([key, label]) => {
      const val = app.scores?.[key];
      const pct = val != null ? (val / 4) * 100 : 0;
      const color = val != null ? (criteriaColors[val] || '#94a3b8') : '#e2e8f0';
      return `<div class="tfit-criteria-row">
        <span class="tfit-criteria-label">${label}</span>
        <div class="tfit-criteria-bar"><div class="tfit-criteria-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="tfit-criteria-val">${val != null ? val.toFixed(1) : '—'}</span>
      </div>`;
    }).join('')}
    <div class="tfit-detail-note">ℹ Calculado automáticamente con información disponible</div>`;
}

function renderDomainBar(name, d) {
  const total = d.apps.length;
  const pFull = Math.round(d.counts.fullyAppropriate / total * 100);
  const pAdeq = Math.round(d.counts.adequate / total * 100);
  const pInap = Math.round(d.counts.inappropriate / total * 100);
  const pNone = 100 - pFull - pAdeq - pInap;
  return `<div class="tfit-domain-row">
    <div class="tfit-domain-name">${escapeHtml(name)}</div>
    <div class="tfit-domain-bar">
      ${pFull > 0 ? `<div class="tfit-bar-seg" style="width:${pFull}%;background:${COLORS.fullyAppropriate}"><span>${d.counts.fullyAppropriate} (${pFull}%)</span></div>` : ''}
      ${pAdeq > 0 ? `<div class="tfit-bar-seg" style="width:${pAdeq}%;background:${COLORS.adequate}"><span>${d.counts.adequate} (${pAdeq}%)</span></div>` : ''}
      ${pInap > 0 ? `<div class="tfit-bar-seg" style="width:${pInap}%;background:${COLORS.inappropriate}"><span>${d.counts.inappropriate} (${pInap}%)</span></div>` : ''}
      ${pNone > 0 ? `<div class="tfit-bar-seg" style="width:${pNone}%;background:${COLORS.unreasonable}"><span>${d.counts.notEvaluable} (${pNone}%)</span></div>` : ''}
    </div>
    <div class="tfit-domain-total">${total}</div>
  </div>`;
}

function renderKpiApps(total) {
  return `<div class="tfit-kpi-card">
    <div class="tfit-kpi-icon tfit-kpi-icon--apps">⬡</div>
    <div class="tfit-kpi-body">
      <div class="tfit-kpi-value">${total}</div>
      <div class="tfit-kpi-label">aplicaciones</div>
      <div class="tfit-kpi-sub">Evaluadas automáticamente</div>
    </div>
  </div>`;
}

function renderKpiCoverage(coverage, evaluated, total) {
  return `<div class="tfit-kpi-card">
    <div class="tfit-kpi-icon tfit-kpi-icon--cov">✓</div>
    <div class="tfit-kpi-body">
      <div class="tfit-kpi-value">${coverage}<span class="tfit-kpi-pct">%</span></div>
      <div class="tfit-kpi-label">Cobertura evaluable</div>
      <div class="tfit-kpi-sub">${evaluated} de ${total} aplicaciones</div>
    </div>
  </div>`;
}

function renderDonutCard(counts, notEvaluable, total) {
  const pct = v => total ? Math.round(v / total * 100) : 0;
  return `<div class="tfit-kpi-card tfit-kpi-card--donut">
    <div class="tfit-donut-title">Distribución del Technical Fit</div>
    <div class="tfit-donut-row">
      <canvas id="tfitDonut" width="100" height="100"></canvas>
      <div class="tfit-donut-legend">
        <div class="tfit-legend-item"><span class="tfit-dot" style="background:${COLORS.fullyAppropriate}"></span>Completamente apropiado<span class="tfit-legend-num">${counts.fullyAppropriate}</span><span class="tfit-legend-pct">${pct(counts.fullyAppropriate)}%</span></div>
        <div class="tfit-legend-item"><span class="tfit-dot" style="background:${COLORS.adequate}"></span>Adecuado<span class="tfit-legend-num">${counts.adequate}</span><span class="tfit-legend-pct">${pct(counts.adequate)}%</span></div>
        <div class="tfit-legend-item"><span class="tfit-dot" style="background:${COLORS.inappropriate}"></span>Inapropiado<span class="tfit-legend-num">${counts.inappropriate}</span><span class="tfit-legend-pct">${pct(counts.inappropriate)}%</span></div>
        <div class="tfit-legend-item"><span class="tfit-dot" style="background:${COLORS.unreasonable}"></span>No evaluable<span class="tfit-legend-num">${notEvaluable + counts.unreasonable}</span><span class="tfit-legend-pct">${pct(notEvaluable + counts.unreasonable)}%</span></div>
      </div>
    </div>
  </div>`;
}

function renderDomainsLegend() {
  return `<div class="tfit-domains-legend">
    ${Object.entries(COLORS).map(([k, c]) => `<span><span class="tfit-dot" style="background:${c}"></span>${LABELS[k]}</span>`).join('')}
  </div>`;
}

function renderFindings({ endOfLife, basicAuth, compPending, noRto }) {
  return `<div class="tfit-findings">
    <h2>Hallazgos para priorizar</h2>
    <div class="tfit-findings-grid">
      <div class="tfit-finding"><div class="tfit-finding-icon tfit-finding-icon--eol">⏱</div><div class="tfit-finding-value">${endOfLife}</div><div class="tfit-finding-label">aplicaciones<br>End of Life</div></div>
      <div class="tfit-finding"><div class="tfit-finding-icon tfit-finding-icon--auth">🔓</div><div class="tfit-finding-value">${basicAuth}</div><div class="tfit-finding-label">aplicaciones<br>con Basic Auth</div></div>
      <div class="tfit-finding"><div class="tfit-finding-icon tfit-finding-icon--comp">📋</div><div class="tfit-finding-value">${compPending}</div><div class="tfit-finding-label">aplicaciones<br>con compliance pendiente</div></div>
      <div class="tfit-finding"><div class="tfit-finding-icon tfit-finding-icon--rto">⏳</div><div class="tfit-finding-value">${noRto}</div><div class="tfit-finding-label">aplicaciones<br>sin RTO informado</div></div>
    </div>
  </div>`;
}

function renderNextSteps() {
  const steps = [
    'Validar pesos con Arquitectura y Operaciones',
    'Completar brechas críticas',
    'Aprobar reglas de evaluación',
    'Conectar Functional Fit y clasificación TIME',
  ];
  return `<div class="tfit-steps">
    <h2>Siguientes pasos</h2>
    <div class="tfit-steps-grid">
      ${steps.map((s, i) => `<div class="tfit-step"><span class="tfit-step-num">${i + 1}</span><span class="tfit-step-text">${s}</span></div>`).join('')}
    </div>
  </div>`;
}

function renderMethodologyModal() {
  return `<div class="tfit-modal-overlay" id="tfitModal">
    <div class="tfit-modal">
      <div class="tfit-modal-header">
        <h2>Metodología de cálculo — Technical Fit</h2>
        <button class="tfit-modal-close" id="tfitModalClose">✕</button>
      </div>
      <div class="tfit-modal-body">
        <p>El <strong>Technical Fit</strong> evalúa automáticamente la salud técnica de cada aplicación usando 6 criterios ponderados.</p>
        <table class="tfit-modal-table">
          <thead><tr><th>Criterio</th><th>Peso</th><th>4 (Mejor)</th><th>3</th><th>2</th><th>1 (Peor)</th></tr></thead>
          <tbody>
            <tr><td><strong>Ciclo de Vida</strong></td><td>30%</td><td>Active</td><td>Phase In</td><td>Phase Out</td><td>End of Life</td></tr>
            <tr><td><strong>Arquitectura</strong></td><td>20%</td><td>Cloud Native</td><td>Basada en Servicios</td><td>Distribuida / StandAlone</td><td>—</td></tr>
            <tr><td><strong>Autenticación</strong></td><td>15%</td><td>SSO</td><td>OAuth2 / AD / JWT</td><td>API Key</td><td>Basic Auth / Sin Auth</td></tr>
            <tr><td><strong>Hosting</strong></td><td>10%</td><td>SaaS / PaaS</td><td>IaaS / On-Premise</td><td>—</td><td>—</td></tr>
            <tr><td><strong>Disponibilidad vs RTO</strong></td><td>15%</td><td>RTO ≤ target</td><td>RTO ≤ 2× target</td><td>RTO ≤ 4× target</td><td>RTO &gt; 4× target</td></tr>
            <tr><td><strong>Compliance</strong></td><td>10%</td><td>Certificado</td><td>No Aplica</td><td>—</td><td>—</td></tr>
          </tbody>
        </table>
        <h3>Fórmula</h3>
        <div class="tfit-modal-formula">Score = Σ(puntajeᵢ × pesoᵢ) / Σ(pesos evaluados)</div>
        <h3>Clasificación final</h3>
        <div class="tfit-modal-ratings">
          <span class="tfit-modal-chip" style="background:#22c55e">≥ 3.25 → Completamente apropiado</span>
          <span class="tfit-modal-chip" style="background:#f59e0b">≥ 2.50 → Adecuado</span>
          <span class="tfit-modal-chip" style="background:#ef4444">≥ 1.75 → Inapropiado</span>
          <span class="tfit-modal-chip" style="background:#6b7280">&lt; 1.75 → No evaluable</span>
        </div>
        <h3>Reglas adicionales</h3>
        <ul>
          <li>Se requiere al menos <strong>50% de peso evaluado</strong> para emitir un resultado.</li>
          <li>El target RTO se define según la disponibilidad: Muy Alto=1h, Alto=4h, Medio=8h, Bajo=24h.</li>
        </ul>
      </div>
    </div>
  </div>`;
}
