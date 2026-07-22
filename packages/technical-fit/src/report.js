import { BaseReport, escapeHtml, getShortName, graphQL } from '@shared/index.js';

const WEIGHTS = { lifecycle: 30, architecture: 20, authentication: 15, hosting: 10, availability: 15, compliance: 10 };

const LABELS = {
  fullyAppropriate: 'Completamente apropiado',
  adequate: 'Adecuado',
  inappropriate: 'Inapropiado',
  unreasonable: 'No evaluable',
};

const COLORS = {
  fullyAppropriate: '#22c55e',
  adequate: '#f59e0b',
  inappropriate: '#ef4444',
  unreasonable: '#d1d5db',
};

function evaluateApp(app) {
  let weightedScore = 0;
  let evaluatedWeight = 0;
  const scores = {};

  // 1. Lifecycle (30%)
  const phase = app.lifecycle?.currentPhase;
  if (phase) {
    const map = { active: 4, phaseIn: 3, phaseOut: 2, endOfLife: 1 };
    if (map[phase]) { weightedScore += map[phase] * 30; evaluatedWeight += 30; scores.lifecycle = map[phase]; }
  }

  // 2. Architecture (20%)
  const arch = app.TipoDeArquitectura;
  if (arch === 'CloudNative') { weightedScore += 4 * 20; evaluatedWeight += 20; scores.architecture = 4; }
  else if (arch === 'BasadaEnServicios') { weightedScore += 3 * 20; evaluatedWeight += 20; scores.architecture = 3; }
  else if (arch === 'Distribuida' || arch === 'StandAlone') { weightedScore += 2 * 20; evaluatedWeight += 20; scores.architecture = 2; }

  // 3. Authentication (15%)
  if (app.TipoDeAutenticacion) {
    const auth = String(app.TipoDeAutenticacion);
    if (auth.includes('SSO')) { weightedScore += 4 * 15; evaluatedWeight += 15; scores.authentication = 4; }
    else if (auth.includes('OAuth2') || auth.includes('ActiveDirectory') || auth.includes('JWT')) { weightedScore += 3 * 15; evaluatedWeight += 15; scores.authentication = 3; }
    else if (auth.includes('APIKey')) { weightedScore += 2 * 15; evaluatedWeight += 15; scores.authentication = 2; }
    else if (auth.includes('BasicAuth') || auth.includes('SinAutenticacion')) { weightedScore += 1 * 15; evaluatedWeight += 15; scores.authentication = 1; }
  }

  // 4. Hosting (10%)
  const host = app.lxHostingType;
  if (host === 'saas' || host === 'paas') { weightedScore += 4 * 10; evaluatedWeight += 10; scores.hosting = 4; }
  else if (host === 'iaas' || host === 'onPremise') { weightedScore += 3 * 10; evaluatedWeight += 10; scores.hosting = 3; }

  // 5. Availability vs RTO (15%)
  const dispMap = { MuyAlto: 1, Alto: 4, Medio: 8, Bajo: 24 };
  const targetRto = dispMap[app.Disponibilidad];
  if (targetRto != null && app.RecoveryTimeObjective != null) {
    const actualRto = Number(app.RecoveryTimeObjective);
    if (!isNaN(actualRto)) {
      let s;
      if (actualRto <= targetRto) s = 4;
      else if (actualRto <= targetRto * 2) s = 3;
      else if (actualRto <= targetRto * 4) s = 2;
      else s = 1;
      weightedScore += s * 15; evaluatedWeight += 15; scores.availability = s;
    }
  }

  // 6. Compliance (10%)
  if (app.ComplianceStandard) {
    const c = String(app.ComplianceStandard).trim();
    if (c && c !== 'Pendiente') {
      if (c === 'No Aplica' || c === 'No aplica') { weightedScore += 3 * 10; scores.compliance = 3; }
      else { weightedScore += 4 * 10; scores.compliance = 4; }
      evaluatedWeight += 10;
    }
  }

  if (evaluatedWeight < 50) return { rating: null, score: null, scores, evaluatedWeight };

  const finalScore = weightedScore / evaluatedWeight;
  let rating;
  if (finalScore < 1.75) rating = 'unreasonable';
  else if (finalScore < 2.50) rating = 'inappropriate';
  else if (finalScore < 3.25) rating = 'adequate';
  else rating = 'fullyAppropriate';

  return { rating, score: Math.round(finalScore * 100) / 100, scores, evaluatedWeight };
}

export class TechnicalFitReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.apps = [];
    this.selectedApp = null;
  }

  async loadData() {
    this.showLoading('Evaluando Technical Fit...');
    try {
      const q = `{ allFactSheets(factSheetType: Application) { edges { node { id displayName
        ... on Application {
          lifecycle { phases { phase startDate } }
          TipoDeArquitectura TipoDeAutenticacion lxHostingType
          Disponibilidad RecoveryTimeObjective ComplianceStandard
          relApplicationToOrganization { edges { node { factSheet { displayName } } } }
        }
      } } } }`;
      const r = await graphQL(q);
      this.apps = r.allFactSheets.edges.map(e => {
        const n = e.node;
        const currentPhase = this.getCurrentPhase(n.lifecycle?.phases);
        const org = n.relApplicationToOrganization?.edges?.[0]?.node?.factSheet?.displayName || 'Sin dominio';
        const app = {
          id: n.id, name: getShortName(n.displayName), fullName: n.displayName,
          lifecycle: { currentPhase }, TipoDeArquitectura: n.TipoDeArquitectura,
          TipoDeAutenticacion: n.TipoDeAutenticacion, lxHostingType: n.lxHostingType,
          Disponibilidad: n.Disponibilidad, RecoveryTimeObjective: n.RecoveryTimeObjective,
          ComplianceStandard: n.ComplianceStandard, domain: getShortName(org),
        };
        const evaluation = evaluateApp(app);
        return { ...app, ...evaluation };
      });
      this.render();
    } catch (error) { this.showError(error); }
  }

  getCurrentPhase(phases) {
    if (!phases || !phases.length) return null;
    const now = new Date().toISOString().slice(0, 10);
    const sorted = [...phases].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    let current = null;
    for (const p of sorted) { if (!p.startDate || p.startDate <= now) current = p.phase; }
    return current;
  }

  render() {
    const total = this.apps.length;
    const evaluated = this.apps.filter(a => a.rating !== null);
    const counts = { fullyAppropriate: 0, adequate: 0, inappropriate: 0, unreasonable: 0 };
    evaluated.forEach(a => counts[a.rating]++);
    const notEvaluable = total - evaluated.length;
    const coverage = total > 0 ? Math.round((evaluated.length / total) * 100) : 0;

    // Domain grouping
    const domains = {};
    this.apps.forEach(a => {
      if (!domains[a.domain]) domains[a.domain] = { apps: [], counts: { fullyAppropriate: 0, adequate: 0, inappropriate: 0, notEvaluable: 0 } };
      domains[a.domain].apps.push(a);
      if (a.rating === null) domains[a.domain].counts.notEvaluable++;
      else if (a.rating === 'unreasonable') domains[a.domain].counts.notEvaluable++;
      else domains[a.domain].counts[a.rating]++;
    });
    const sortedDomains = Object.entries(domains).sort((a, b) => b[1].apps.length - a[1].apps.length).slice(0, 8);

    // Findings
    const endOfLife = this.apps.filter(a => a.lifecycle?.currentPhase === 'endOfLife').length;
    const basicAuth = this.apps.filter(a => a.TipoDeAutenticacion && String(a.TipoDeAutenticacion).includes('BasicAuth')).length;
    const compPending = this.apps.filter(a => !a.ComplianceStandard || String(a.ComplianceStandard).trim() === '' || String(a.ComplianceStandard).trim() === 'Pendiente').length;
    const noRto = this.apps.filter(a => a.RecoveryTimeObjective == null || a.RecoveryTimeObjective === '').length;

    this.container.innerHTML = `
      <div class="tfit">
        <div class="tfit-header">
          <h1>Technical Fit — Evaluación automática del portafolio</h1>
          <div class="tfit-badges"><span class="tfit-badge">Resultado automático</span></div>
          <button class="tfit-info-btn" id="tfitInfoBtn" title="Ver metodología">ℹ</button>
        </div>

        <div class="tfit-modal-overlay" id="tfitModal">
          <div class="tfit-modal">
            <div class="tfit-modal-header">
              <h2>Metodología de cálculo — Technical Fit</h2>
              <button class="tfit-modal-close" id="tfitModalClose">✕</button>
            </div>
            <div class="tfit-modal-body">
              <p>El <strong>Technical Fit</strong> evalúa automáticamente la salud técnica de cada aplicación usando 6 criterios ponderados. Cada criterio recibe un puntaje de 1 a 4 y se pondera según su peso relativo.</p>

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
                <span class="tfit-modal-chip" style="background:#6b7280">< 1.75 → No evaluable</span>
              </div>

              <h3>Reglas adicionales</h3>
              <ul>
                <li>Se requiere al menos <strong>50% de peso evaluado</strong> (mínimo 3 criterios con datos) para emitir un resultado.</li>
                <li>Si no se alcanza el 50%, la aplicación se marca como <em>No evaluable</em>.</li>
                <li>El target RTO se define según la disponibilidad: Muy Alto=1h, Alto=4h, Medio=8h, Bajo=24h.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="tfit-layout">
          <div class="tfit-main">
            <div class="tfit-top">
              <div class="tfit-kpi-card">
                <div class="tfit-kpi-icon tfit-kpi-icon--apps">⬡</div>
                <div class="tfit-kpi-body">
                  <div class="tfit-kpi-value">${total}</div>
                  <div class="tfit-kpi-label">aplicaciones</div>
                  <div class="tfit-kpi-sub">Evaluadas automáticamente</div>
                </div>
              </div>
              <div class="tfit-kpi-card">
                <div class="tfit-kpi-icon tfit-kpi-icon--cov">✓</div>
                <div class="tfit-kpi-body">
                  <div class="tfit-kpi-value">${coverage}<span class="tfit-kpi-pct">%</span></div>
                  <div class="tfit-kpi-label">Cobertura evaluable</div>
                  <div class="tfit-kpi-sub">${evaluated.length} de ${total} aplicaciones</div>
                </div>
              </div>
              <div class="tfit-kpi-card tfit-kpi-card--donut">
                <div class="tfit-donut-title">Distribución del Technical Fit</div>
                <div class="tfit-donut-row">
                  <canvas id="tfitDonut" width="100" height="100"></canvas>
                  <div class="tfit-donut-legend">
                    <div class="tfit-legend-item"><span class="tfit-dot" style="background:${COLORS.fullyAppropriate}"></span>Completamente apropiado<span class="tfit-legend-num">${counts.fullyAppropriate}</span><span class="tfit-legend-pct">${total ? Math.round(counts.fullyAppropriate / total * 100) : 0}%</span></div>
                    <div class="tfit-legend-item"><span class="tfit-dot" style="background:${COLORS.adequate}"></span>Adecuado<span class="tfit-legend-num">${counts.adequate}</span><span class="tfit-legend-pct">${total ? Math.round(counts.adequate / total * 100) : 0}%</span></div>
                    <div class="tfit-legend-item"><span class="tfit-dot" style="background:${COLORS.inappropriate}"></span>Inapropiado<span class="tfit-legend-num">${counts.inappropriate}</span><span class="tfit-legend-pct">${total ? Math.round(counts.inappropriate / total * 100) : 0}%</span></div>
                    <div class="tfit-legend-item"><span class="tfit-dot" style="background:${COLORS.unreasonable}"></span>No evaluable<span class="tfit-legend-num">${notEvaluable + counts.unreasonable}</span><span class="tfit-legend-pct">${total ? Math.round((notEvaluable + counts.unreasonable) / total * 100) : 0}%</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="tfit-domains">
              <div class="tfit-domains-header">
                <h2>Technical Fit por dominio</h2>
                <div class="tfit-domains-legend">
                  <span><span class="tfit-dot" style="background:${COLORS.fullyAppropriate}"></span>Completamente apropiado</span>
                  <span><span class="tfit-dot" style="background:${COLORS.adequate}"></span>Adecuado</span>
                  <span><span class="tfit-dot" style="background:${COLORS.inappropriate}"></span>Inapropiado</span>
                  <span><span class="tfit-dot" style="background:${COLORS.unreasonable}"></span>No evaluable</span>
                </div>
              </div>
              ${sortedDomains.map(([name, d]) => this.renderDomainBar(name, d)).join('')}
            </div>

            <div class="tfit-bottom">
              <div class="tfit-findings">
                <h2>Hallazgos para priorizar</h2>
                <div class="tfit-findings-grid">
                  <div class="tfit-finding"><div class="tfit-finding-icon tfit-finding-icon--eol">⏱</div><div class="tfit-finding-value">${endOfLife}</div><div class="tfit-finding-label">aplicaciones<br>End of Life</div></div>
                  <div class="tfit-finding"><div class="tfit-finding-icon tfit-finding-icon--auth">🔓</div><div class="tfit-finding-value">${basicAuth}</div><div class="tfit-finding-label">aplicaciones<br>con Basic Auth</div></div>
                  <div class="tfit-finding"><div class="tfit-finding-icon tfit-finding-icon--comp">📋</div><div class="tfit-finding-value">${compPending}</div><div class="tfit-finding-label">aplicaciones<br>con compliance pendiente</div></div>
                  <div class="tfit-finding"><div class="tfit-finding-icon tfit-finding-icon--rto">⏳</div><div class="tfit-finding-value">${noRto}</div><div class="tfit-finding-label">aplicaciones<br>sin RTO informado</div></div>
                </div>
              </div>
              <div class="tfit-steps">
                <h2>Siguientes pasos</h2>
                <div class="tfit-steps-grid">
                  <div class="tfit-step"><span class="tfit-step-num">1</span><span class="tfit-step-text">Validar pesos con Arquitectura y Operaciones</span></div>
                  <div class="tfit-step"><span class="tfit-step-num">2</span><span class="tfit-step-text">Completar brechas críticas</span></div>
                  <div class="tfit-step"><span class="tfit-step-num">3</span><span class="tfit-step-text">Aprobar reglas de evaluación</span></div>
                  <div class="tfit-step"><span class="tfit-step-num">4</span><span class="tfit-step-text">Conectar Functional Fit y clasificación TIME</span></div>
                </div>
              </div>
            </div>

            <div class="tfit-footer">Modelo v1.0 · Datos del inventario LeanIX · Resultado sujeto a nivel de completitud</div>
          </div>

          <div class="tfit-sidebar">
            <div class="tfit-detail-panel" id="tfitDetail">
              <div class="tfit-detail-empty">Selecciona una aplicación</div>
            </div>
            <div class="tfit-app-list" id="tfitAppList">
              <input type="text" id="tfitSearch" class="tfit-search" placeholder="Buscar aplicación...">
              <div class="tfit-app-table" id="tfitTable">
                ${this.renderAppTable(this.apps)}
              </div>
            </div>
          </div>
        </div>
      </div>`;

    this.drawDonut(counts, notEvaluable);
    this.bindEvents();
  }

  renderDomainBar(name, d) {
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

  renderAppTable(apps) {
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

  drawDonut(counts, notEvaluable) {
    const canvas = document.getElementById('tfitDonut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = [
      { value: counts.fullyAppropriate, color: COLORS.fullyAppropriate },
      { value: counts.adequate, color: COLORS.adequate },
      { value: counts.inappropriate, color: COLORS.inappropriate },
      { value: notEvaluable + counts.unreasonable, color: COLORS.unreasonable },
    ];
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return;

    const cx = 50, cy = 50, r = 40, lineWidth = 14;
    let startAngle = -Math.PI / 2;
    data.forEach(seg => {
      if (seg.value === 0) return;
      const sliceAngle = (seg.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      startAngle += sliceAngle;
    });
  }

  showDetail(app) {
    const panel = document.getElementById('tfitDetail');
    if (!panel || !app) return;
    const criteriaLabels = { lifecycle: 'Lifecycle (30%)', architecture: 'Arquitectura (20%)', authentication: 'Autenticación (15%)', hosting: 'Hosting (10%)', availability: 'Disponibilidad / RTO (15%)', compliance: 'Compliance (10%)' };
    const criteriaColors = { 4: COLORS.fullyAppropriate, 3: COLORS.adequate, 2: COLORS.inappropriate, 1: COLORS.unreasonable };

    panel.innerHTML = `
      <div class="tfit-detail-name">${escapeHtml(app.name)}</div>
      <div class="tfit-detail-score" style="background:${COLORS[app.rating] || COLORS.unreasonable}">${app.score != null ? app.score.toFixed(2) : '—'} · ${LABELS[app.rating] || 'No evaluable'}</div>
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

  bindEvents() {
    // Info modal
    const infoBtn = document.getElementById('tfitInfoBtn');
    const modal = document.getElementById('tfitModal');
    const closeBtn = document.getElementById('tfitModalClose');
    if (infoBtn && modal) {
      infoBtn.addEventListener('click', () => modal.classList.add('tfit-modal--open'));
      closeBtn.addEventListener('click', () => modal.classList.remove('tfit-modal--open'));
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('tfit-modal--open'); });
    }

    // App row click
    this.container.querySelectorAll('.tfit-app-row').forEach(row => {
      row.addEventListener('click', () => {
        const app = this.apps.find(a => a.id === row.dataset.id);
        if (app) this.showDetail(app);
      });
    });

    // Domain bar click
    this.container.querySelectorAll('.tfit-domain-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.querySelector('.tfit-domain-name')?.textContent;
        const filtered = name ? this.apps.filter(a => a.domain === name) : this.apps;
        const table = document.getElementById('tfitTable');
        if (table) table.innerHTML = this.renderAppTable(filtered);
        this.rebindRows();
      });
    });

    // Search
    const search = document.getElementById('tfitSearch');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        const filtered = this.apps.filter(a => a.name.toLowerCase().includes(q) || a.domain.toLowerCase().includes(q));
        const table = document.getElementById('tfitTable');
        if (table) table.innerHTML = this.renderAppTable(filtered);
        this.rebindRows();
      });
    }
  }

  rebindRows() {
    this.container.querySelectorAll('.tfit-app-row').forEach(row => {
      row.addEventListener('click', () => {
        const app = this.apps.find(a => a.id === row.dataset.id);
        if (app) this.showDetail(app);
      });
    });
  }
}
