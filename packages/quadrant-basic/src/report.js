/**
 * 4. report.js — ORQUESTADOR
 *
 * Responsabilidad: coordinar query → calc → render → eventos.
 * Es el único archivo que toca el DOM directamente.
 */

import { BaseReport }        from '@shared/index.js';
import { fetchApplications } from './report.query.js';
import { scoreApp, getColor } from './report.calc.js';
import { renderShell, renderTooltip } from './report.render.js';

const PAD  = { top: 30, right: 30, bottom: 40, left: 40 };
const AXIS = { min: 0, max: 100 };

// 4.1 Clase principal del reporte
export class QuadrantBasicReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.apps    = [];
    this._bubbles = [];
  }

  // 4.2 Carga datos y calcula scores
  async loadData() {
    this.showLoading('Cargando...');
    try {
      const raw  = await fetchApplications();
      this.apps  = raw
        .map(app => ({ ...app, ...scoreApp(app) }))
        .filter(app => app.agility != null && app.resilience != null);
      this.render();
    } catch (e) {
      this.showError(e);
    }
  }

  // 4.3 Renderiza shell y dibuja el canvas
  render() {
    this.container.innerHTML = renderShell();
    this._drawChart();
    this._bindEvents();
  }

  // 4.4 Dibuja ejes, líneas divisorias y burbujas
  _drawChart() {
    const canvas = this.container.querySelector('#qbCanvas');
    const dpr    = window.devicePixelRatio || 1;
    const W      = (canvas.parentElement.clientWidth || 700) - 32;
    const H      = Math.round(W * 0.65);

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx  = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top  - PAD.bottom;
    const range = AXIS.max - AXIS.min;
    const toX   = v => PAD.left + (v / range) * plotW;
    const toY   = v => PAD.top  + ((100 - v) / range) * plotH;

    // Líneas divisorias en 50/50
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(toX(50), PAD.top);  ctx.lineTo(toX(50), H - PAD.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left, toY(50)); ctx.lineTo(W - PAD.right, toY(50));  ctx.stroke();

    // Etiquetas de ejes
    ctx.fillStyle  = '#64748b';
    ctx.font       = '11px sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText('AGILIDAD →',    W / 2,          H - 5);
    ctx.save();
    ctx.translate(12, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('RESILIENCIA ↑', 0, 0);
    ctx.restore();

    // Números en ejes
    ctx.fillStyle = '#94a3b8';
    ctx.font      = '9px sans-serif';
    [0, 25, 50, 75, 100].forEach(v => {
      ctx.textAlign = 'center'; ctx.fillText(v, toX(v), H - PAD.bottom + 12);
      ctx.textAlign = 'right';  ctx.fillText(v, PAD.left - 4, toY(v) + 3);
    });

    // Burbujas
    this._bubbles = [];
    this.apps.forEach(app => {
      const x = toX(app.agility);
      const y = toY(app.resilience);
      const r = app.size;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = getColor(app.agility, app.resilience) + 'cc';
      ctx.fill();

      this._bubbles.push({ app, x, y, r });
    });

    // Guardar dimensiones CSS para hit-testing
    canvas._cssW = W;
    canvas._cssH = H;
  }

  // 4.5 Hover para tooltip, click vacío por ahora
  _bindEvents() {
    const canvas  = this.container.querySelector('#qbCanvas');
    const tooltip = this.container.querySelector('#qbTooltip');

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      const hit  = this._bubbles.find(b => Math.hypot(mx - b.x, my - b.y) <= b.r + 4);

      if (hit) {
        tooltip.innerHTML = renderTooltip(hit.app);
        tooltip.hidden    = false;
        tooltip.style.left = (mx + 14) + 'px';
        tooltip.style.top  = (my - 10) + 'px';
        canvas.style.cursor = 'pointer';
      } else {
        tooltip.hidden = true;
        canvas.style.cursor = 'default';
      }
    });

    canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  }
}
