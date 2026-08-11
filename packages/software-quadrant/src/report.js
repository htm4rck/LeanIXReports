/**
 * 4. report.js — ORQUESTADOR
 */

import { BaseReport } from '@shared/index.js';
import { escapeHtml } from '@shared/index.js';
import { fetchApplications } from './report.query.js';
import { scoreApp, getQuartileColor, getQuartileLabel, getRiskLevel, getQuartile, BENCHMARK, QUADRANT_META, getTopCritical } from './report.calc.js';
import { renderShell, renderTooltip, renderDetailPanel } from './report.render.js';

const AXIS = { min: 0, max: 100 };
const PAD  = { top: 40, right: 100, bottom: 50, left: 50 };

// 4.1 Clase principal del reporte
export class SoftwareQuadrantReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.apps     = [];
    this.filters  = { domain: '', type: '', quartile: '', search: '' };
    this._bubbles = [];
    this._selectedId = null;
  }

  // 4.2 Apps filtradas según estado actual de filtros
  get filteredApps() {
    return this.apps.filter(a => {
      if (a.agility == null || a.resilience == null) return false;
      if (this.filters.domain   && a.domain        !== this.filters.domain)   return false;
      if (this.filters.type     && a.TipoAplicacion !== this.filters.type)     return false;
      if (this.filters.quartile && getQuartile(a.agility, a.resilience) !== this.filters.quartile) return false;
      if (this.filters.search) {
        const q = this.filters.search.toLowerCase();
        if (!a.name.toLowerCase().includes(q) && !a.domain.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  // 4.3 Carga datos desde LeanIX y calcula scores
  async loadData() {
    this.showLoading('Cargando portafolio...');
    try {
      const raw = await fetchApplications();
      this.apps = raw.map(app => ({ ...app, ...scoreApp(app) }));
      this.render();
    } catch (error) {
      this.showError(error);
    }
  }

  // 4.4 Renderiza el shell y redibuja el canvas
  render() {
    const apps = this.filteredApps;
    this.container.innerHTML = renderShell(apps, this.filters);
    this._resizeCanvas();
    this.drawChart(apps);
    this.bindEvents();
  }

  // 4.5 Escala el canvas por devicePixelRatio para pantallas de alta densidad
  _resizeCanvas() {
    const wrap   = this.container.querySelector('.sq-canvas-wrap');
    const canvas = this.container.querySelector('#sqCanvas');
    if (!wrap || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth  || 700;
    const h = wrap.clientHeight || Math.round(w * 0.68);
    // Escalar el canvas por devicePixelRatio para pantallas de alta densidad
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // Guardar dimensiones CSS para que drawChart las use
    canvas._cssWidth  = w;
    canvas._cssHeight = h;
  }

  // 4.6 Dibuja el cuadrante: fondos, ejes, burbujas, badges y etiquetas
  drawChart(apps) {
    const canvas = this.container.querySelector('#sqCanvas');
    if (!canvas) return;
    const ctx   = canvas.getContext('2d');
    const W     = canvas._cssWidth  || canvas.width;
    const H     = canvas._cssHeight || canvas.height;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top  - PAD.bottom;
    const range = AXIS.max - AXIS.min;

    const toX = v => PAD.left + ((v - AXIS.min) / range) * plotW;
    const toY = v => PAD.top  + ((AXIS.max - v) / range) * plotH;

    ctx.clearRect(0, 0, W, H);

    // Líneas divisorias en 50/50 (cuadrantes iguales)
    const mx = toX(50);
    const my = toY(50);
    // Líneas de benchmark
    const bx = toX(BENCHMARK.agility);
    const by = toY(BENCHMARK.resilience);

    // Fondos de cuadrante
    const quadBg = [
      { x: PAD.left, y: PAD.top, w: mx - PAD.left,     h: my - PAD.top,        color: 'rgba(234,179,8,0.07)'   }, // topLeft
      { x: mx,       y: PAD.top, w: W - PAD.right - mx, h: my - PAD.top,        color: 'rgba(34,197,94,0.07)'   }, // topRight
      { x: PAD.left, y: my,      w: mx - PAD.left,      h: H - PAD.bottom - my, color: 'rgba(239,68,68,0.08)'   }, // bottomLeft
      { x: mx,       y: my,      w: W - PAD.right - mx, h: H - PAD.bottom - my, color: 'rgba(249,115,22,0.07)'  }, // bottomRight
    ];
    quadBg.forEach(q => { ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, q.w, q.h); });

    // Nombres de cuadrante dentro del gráfico
    const font = `'Gill Sans MT', 'Gill Sans', Calibri, sans-serif`;
    const quadLabels = [
      { meta: QUADRANT_META.topLeft,     x: PAD.left + 10,     y: PAD.top + 18 },
      { meta: QUADRANT_META.topRight,    x: mx + 10,           y: PAD.top + 18 },
      { meta: QUADRANT_META.bottomLeft,  x: PAD.left + 10,     y: my + 18 },
      { meta: QUADRANT_META.bottomRight, x: mx + 10,           y: my + 18 },
    ];
    quadLabels.forEach(({ meta, x, y }) => {
        ctx.font = `bold 9px ${font}`;
      ctx.fillStyle = 'rgba(30,41,59,0.40)';
      ctx.textAlign = 'left';
      ctx.fillText(`${meta.icon} ${meta.label}`, x, y);
      ctx.font = `8px ${font}`;
      ctx.fillStyle = 'rgba(100,116,139,0.5)';
      ctx.fillText(meta.desc, x, y + 12);
    });

    // Línea divisoria principal 50/50 — sólida
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(mx, PAD.top);  ctx.lineTo(mx, H - PAD.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left, my); ctx.lineTo(W - PAD.right, my);  ctx.stroke();

    // Líneas de benchmark — punteadas tenues
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, PAD.top);  ctx.lineTo(bx, H - PAD.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left, by); ctx.lineTo(W - PAD.right, by);  ctx.stroke();
    ctx.restore();

    // Etiquetas de benchmark en los ejes
    ctx.font = `9px ${font}`;
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(`Benchmark ${BENCHMARK.agility}`, bx, H - PAD.bottom + 24);
    ctx.textAlign = 'right';
    ctx.fillText(`Benchmark ${BENCHMARK.resilience}`, W - PAD.right + 95, by + 4);

    // Etiquetas numéricas de ejes
    ctx.fillStyle = '#94a3b8';
    ctx.font = `9px ${font}`;
    for (let v = 0; v <= 100; v += 25) {
      ctx.textAlign = 'center'; ctx.fillText(v, toX(v), H - PAD.bottom + 14);
      ctx.textAlign = 'right';  ctx.fillText(v, PAD.left - 5, toY(v) + 3);
    }

    // Agrupar apps que caen en el mismo punto (mismo agility+resilience)
    const groups = new Map();
    apps.forEach(app => {
      const key = `${app.agility}_${app.resilience}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(app);
    });

    // Dibuja cada grupo. Si hay más de 1 app en el punto, muestra badge con count.
    this._bubbles = [];
    groups.forEach(group => {
      const app   = group[0]; // representante visual
      const count = group.length;
      const x     = toX(app.agility);
      const y     = toY(app.resilience);
      const r     = Math.max(...group.map(a => a.size)); // radio del más grande
      const color = getQuartileColor(app.agility, app.resilience);
      const isSelected = group.some(a => a.id === this._selectedId);

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color + (isSelected ? 'ff' : 'cc');
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Badge de conteo si hay más de 1 app en el punto
      if (count > 1) {
        const br = 7;
        const bx = x + r - 2;
        const by = y - r + 2;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.font = `bold 7px ${font}`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(count, bx, by + 2.5);
      }

      // Etiqueta solo para top 5 críticas y app seleccionada
      const topCriticalIds = new Set(getTopCritical(apps, 5).map(a => a.id));
      if (group.some(a => topCriticalIds.has(a.id)) || isSelected) {
        const label = (count > 1 ? `(${count}) ` : '') +
          (app.name.length > 16 ? app.name.slice(0, 15) + '…' : app.name);
        ctx.font = `8px ${font}`;
        ctx.textAlign = 'center';
        const above = y - r - 4 > PAD.top + 12;
        const lx = x;
        const ly = above ? y - r - 10 : y + r + 10;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(lx - tw / 2 - 2, ly - 8, tw + 4, 10);
        ctx.fillStyle = '#1e293b';
        ctx.fillText(label, lx, ly);
      }

      // Registrar todas las apps del grupo para hit-testing
      group.forEach(a => this._bubbles.push({ app: a, group, x, y, r }));
    });
  }

  // 4.7 Registra todos los event listeners del reporte
  bindEvents() {
    const canvas  = this.container.querySelector('#sqCanvas');
    const tooltip = this.container.querySelector('#sqTooltip');
    const detail  = this.container.querySelector('#sqDetail');

    if (canvas && tooltip) {
      canvas.addEventListener('mousemove', e => {
        const { mx, my } = this._coords(canvas, e);
        const hit = this._bubbles.find(b => Math.hypot(mx - b.x, my - b.y) <= b.r + 4);
        if (hit) {
          const { app, group } = hit;
          if (group.length > 1) {
            tooltip.innerHTML = `
              <div class="sq-tt-name">${group.length} apps en este punto</div>
              ${group.map(a => `<div class="sq-tt-row"><span>${escapeHtml(a.name)}</span></div>`).join('')}
              <div class="sq-tt-risk" style="color:#94a3b8">Agilidad ${app.agility} · Resiliencia ${app.resilience}</div>`;
          } else {
            tooltip.innerHTML = renderTooltip(app);
          }
          tooltip.hidden = false;
          const wr = canvas.parentElement.getBoundingClientRect();
          let tx = e.clientX - wr.left + 14;
          let ty = e.clientY - wr.top  - 10;
          if (tx + 200 > wr.width)  tx -= 220;
          if (ty + 140 > wr.height) ty -= 150;
          tooltip.style.left = tx + 'px';
          tooltip.style.top  = ty + 'px';
          canvas.style.cursor = 'pointer';
        } else {
          tooltip.hidden = true;
          canvas.style.cursor = 'default';
        }
      });

      canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });

      canvas.addEventListener('click', e => {
        const { mx, my } = this._coords(canvas, e);
        const hit = this._bubbles.find(b => Math.hypot(mx - b.x, my - b.y) <= b.r + 4);
        if (hit && detail) {
          const { app, group } = hit;
          if (group.length > 1) {
            // Mostrar lista del grupo para que el usuario elija
            this._selectedId = app.id;
            detail.innerHTML = `
              <div class="sq-sidebar-title">APLICACIONES EN ESTE PUNTO <span id="sqDetailClose" class="sq-detail-close">✕</span></div>
              <div class="sq-group-info">Agilidad ${app.agility} · Resiliencia ${app.resilience} · ${group.length} apps</div>
              <ul class="sq-group-list">
                ${group.map(a => `<li class="sq-group-item" data-id="${escapeHtml(a.id)}">
                  <span class="sq-group-dot" style="background:${getQuartileColor(a.agility, a.resilience)}"></span>
                  <span>${escapeHtml(a.name)}</span>
                  <span class="sq-group-crit">${escapeHtml(a.criticidadDeDatos || '—')}</span>
                </li>`).join('')}
              </ul>`;
            // Clic en item de la lista
            detail.querySelectorAll('.sq-group-item').forEach(item => {
              item.addEventListener('click', () => {
                const a = group.find(x => x.id === item.dataset.id);
                if (a) {
                  this._selectedId = a.id;
                  detail.innerHTML = `
                    <div class="sq-sidebar-title">APLICACIÓN SELECCIONADA <span id="sqDetailClose" class="sq-detail-close">✕</span></div>
                    ${renderDetailPanel(a)}`;
                  this._bindDetailClose(detail);
                  this.drawChart(this.filteredApps);
                }
              });
            });
          } else {
            this._selectedId = app.id;
            detail.innerHTML = `
              <div class="sq-sidebar-title">APLICACIÓN SELECCIONADA <span id="sqDetailClose" class="sq-detail-close">✕</span></div>
              ${renderDetailPanel(app)}`;
            this._bindDetailClose(detail);
          }
          this.drawChart(this.filteredApps);
          this.container.querySelector('#sqDetailClose')?.addEventListener('click', () => {
            this._selectedId = null;
            detail.innerHTML = `<div class="sq-sidebar-title">APLICACIÓN SELECCIONADA</div><p class="sq-detail-empty">Haz clic en una burbuja para ver el detalle</p>`;
            this.drawChart(this.filteredApps);
          });
        }
      });
    }

    // Filtros
    this.container.querySelector('#sqFilterDomain')?.addEventListener('change', e => {
      this.filters.domain = e.target.value; this.render();
    });
    this.container.querySelector('#sqFilterType')?.addEventListener('change', e => {
      this.filters.type = e.target.value; this.render();
    });
    this.container.querySelector('#sqFilterQuartile')?.addEventListener('change', e => {
      this.filters.quartile = e.target.value; this.render();
    });
    this.container.querySelector('#sqFilterSearch')?.addEventListener('input', e => {
      this.filters.search = e.target.value; this.render();
    });
    this.container.querySelector('#sqClearFilters')?.addEventListener('click', () => {
      this.filters = { domain: '', type: '', quartile: '', search: '' };
      this.render();
    });

    // Clic en fila de distribución → filtra por cuartil
    this.container.querySelectorAll('.sq-dist-row').forEach(row => {
      row.addEventListener('click', () => {
        const q = row.dataset.quartile;
        this.filters.quartile = this.filters.quartile === q ? '' : q;
        this.render();
      });
    });

    // Acción rápida: ver solo críticas
    this.container.querySelector('[data-action="critical"]')?.addEventListener('click', () => {
      this.filters.quartile = 'bottomLeft'; this.render();
    });

    // Ver por dominio: abre el select de dominio
    this.container.querySelector('[data-action="domain"]')?.addEventListener('click', () => {
      this.container.querySelector('#sqFilterDomain')?.focus();
    });

    // Exportar reporte: descarga CSV con las apps filtradas
    this.container.querySelector('[data-action="export"]')?.addEventListener('click', () => {
      this._exportCSV(this.filteredApps);
    });

    // Metodología: muestra modal con explicación del cálculo
    this.container.querySelector('[data-action="method"]')?.addEventListener('click', () => {
      this._showMethodModal();
    });

    // Clic en "Ver detalle" en la tabla
    this.container.querySelectorAll('.sq-btn-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const app = this.filteredApps.find(a => a.id === btn.dataset.id);
        if (app && detail) {
          this._selectedId = app.id;
          detail.innerHTML = `
            <div class="sq-sidebar-title">APLICACIÓN SELECCIONADA <span id="sqDetailClose" class="sq-detail-close">✕</span></div>
            ${renderDetailPanel(app)}`;
          this.container.querySelector('#sqDetailClose')?.addEventListener('click', () => {
            this._selectedId = null;
            detail.innerHTML = `<div class="sq-sidebar-title">APLICACIÓN SELECCIONADA</div><p class="sq-detail-empty">Haz clic en una burbuja para ver el detalle</p>`;
            this.drawChart(this.filteredApps);
          });
          this.drawChart(this.filteredApps);
          detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  // 4.8 Descarga CSV con las apps filtradas
  _exportCSV(apps) {
    const headers = ['Aplicacion','Dominio','Tipo','CriticidadDeDatos','Agilidad','Resiliencia','Cuartil','Riesgo','Lifecycle','Hosting','RTO'];
    const rows = apps.map(a => [
      `"${a.name}"`,
      `"${a.domain}"`,
      `"${a.TipoAplicacion || ''}"`,
      `"${a.criticidadDeDatos || ''}"`,
      a.agility,
      a.resilience,
      `"${getQuartileLabel(a.agility, a.resilience)}"`,
      `"${getRiskLevel(a.agility, a.resilience).label}"`,
      `"${a.lifecycle?.currentPhase || ''}"`,
      `"${a.lxHostingType || ''}"`,
      a.RecoveryTimeObjective ?? '',
    ].join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'portafolio-salud.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // 4.9 Muestra modal con tablas de metodología de cálculo
  _showMethodModal() {
    const existing = document.getElementById('sqMethodModal');
    if (existing) { existing.remove(); return; }
    const modal = document.createElement('div');
    modal.id = 'sqMethodModal';
    modal.innerHTML = `
      <div class="sq-modal-backdrop"></div>
      <div class="sq-modal">
        <div class="sq-modal-header">
          <strong>Metodología de evaluación</strong>
          <span class="sq-modal-close" id="sqModalClose">✕</span>
        </div>
        <div class="sq-modal-body">
          <h4>Eje X — Agilidad (0–100)</h4>
          <p>Mide la capacidad de la aplicación para adaptarse y evolucionar.</p>
          <table class="sq-modal-table">
            <tr><th>Campo LeanIX</th><th>Valor</th><th>Puntos</th></tr>
            <tr><td>technicalSuitability</td><td>fullyAppropriate</td><td>90</td></tr>
            <tr><td></td><td>appropriate</td><td>75</td></tr>
            <tr><td></td><td>adequate</td><td>60</td></tr>
            <tr><td></td><td>inappropriate</td><td>35</td></tr>
            <tr><td></td><td>unreasonable</td><td>15</td></tr>
            <tr><td>TipoDeArquitectura (bonus)</td><td>CloudNative</td><td>+15</td></tr>
            <tr><td></td><td>BasadaEnServicios</td><td>+8</td></tr>
            <tr><td></td><td>StandAlone</td><td>−10</td></tr>
          </table>

          <h4>Eje Y — Resiliencia (0–100)</h4>
          <p>Mide la capacidad de la aplicación para mantenerse operativa ante fallas.</p>
          <table class="sq-modal-table">
            <tr><th>Campo LeanIX</th><th>Valor</th><th>Puntos</th></tr>
            <tr><td>lifecycle</td><td>active</td><td>80</td></tr>
            <tr><td></td><td>phaseIn</td><td>70</td></tr>
            <tr><td></td><td>phaseOut</td><td>40</td></tr>
            <tr><td></td><td>endOfLife</td><td>20</td></tr>
            <tr><td>lxHostingType (bonus)</td><td>saas</td><td>+10</td></tr>
            <tr><td></td><td>paas</td><td>+8</td></tr>
            <tr><td></td><td>onPremise</td><td>−5</td></tr>
            <tr><td>RecoveryTimeObjective (bonus)</td><td>≤4h</td><td>+8</td></tr>
          </table>

          <h4>Tamaño de burbuja — Criticidad de datos</h4>
          <table class="sq-modal-table">
            <tr><th>criticidadDeDatos (LeanIX)</th><th>Tamaño</th></tr>
            <tr><td>MuySignificativo</td><td>Grande</td></tr>
            <tr><td>Significativo</td><td>Grande</td></tr>
            <tr><td>Moderado</td><td>Mediano</td></tr>
            <tr><td>Bajo</td><td>Pequeño</td></tr>
          </table>

          <h4>KPI “Aplicaciones críticas”</h4>
          <p>Apps con <code>criticidadDeDatos = MuySignificativo</code> o <code>Significativo</code>. Es un dato directo de LeanIX, no calculado.</p>

          <h4>Cuadrantes</h4>
          <p>La línea divisoria está en 50/50. Las líneas punteadas muestran el benchmark CAST (Agilidad ${BENCHMARK.agility} · Resiliencia ${BENCHMARK.resilience}).</p>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#sqModalClose').addEventListener('click', () => modal.remove());
    modal.querySelector('.sq-modal-backdrop').addEventListener('click', () => modal.remove());
  }

  // 4.10 Enlaza el botón de cierre del panel de detalle
  _bindDetailClose(detail) {
    detail.querySelector('#sqDetailClose')?.addEventListener('click', () => {
      this._selectedId = null;
      detail.innerHTML = `<div class="sq-sidebar-title">APLICACIÓN SELECCIONADA</div><p class="sq-detail-empty">Haz clic en una burbuja para ver el detalle</p>`;
      this.drawChart(this.filteredApps);
    });
  }

  // 4.11 Convierte coordenadas del mouse a coordenadas CSS del canvas
  _coords(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return {
      mx: (e.clientX - rect.left) * ((canvas._cssWidth  || rect.width)  / rect.width),
      my: (e.clientY - rect.top)  * ((canvas._cssHeight || rect.height) / rect.height),
    };
  }
}
