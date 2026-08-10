import { BaseReport } from '@shared/index.js';
import { fetchApplications } from './report.query.js';
import { evaluateApp, groupByDomain, getFindings, getSummary } from './report.calc.js';
import { renderShell, renderAppTable, renderDetail } from './report.render.js';

export class TechnicalFitReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.apps = [];
  }

  async loadData() {
    this.showLoading('Evaluando Technical Fit...');
    try {
      const raw = await fetchApplications();
      this.apps = raw.map(app => ({ ...app, ...evaluateApp(app) }));
      this.render();
    } catch (error) {
      this.showError(error);
    }
  }

  render() {
    const summary = getSummary(this.apps);
    const sortedDomains = groupByDomain(this.apps);
    const findings = getFindings(this.apps);

    this.container.innerHTML = renderShell(summary, sortedDomains, findings, this.apps);
    this.drawDonut(summary.counts, summary.notEvaluable);
    this.bindEvents();
  }

  drawDonut(counts, notEvaluable) {
    const canvas = document.getElementById('tfitDonut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const COLORS_MAP = {
      fullyAppropriate: '#22c55e', adequate: '#f59e0b',
      inappropriate: '#ef4444', unreasonable: '#d1d5db',
    };
    const data = [
      { value: counts.fullyAppropriate, color: COLORS_MAP.fullyAppropriate },
      { value: counts.adequate,         color: COLORS_MAP.adequate },
      { value: counts.inappropriate,    color: COLORS_MAP.inappropriate },
      { value: notEvaluable + counts.unreasonable, color: COLORS_MAP.unreasonable },
    ];
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) return;

    let startAngle = -Math.PI / 2;
    data.forEach(seg => {
      if (!seg.value) return;
      const sliceAngle = (seg.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(50, 50, 40, startAngle, startAngle + sliceAngle);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = 14;
      ctx.stroke();
      startAngle += sliceAngle;
    });
  }

  bindEvents() {
    const modal = document.getElementById('tfitModal');
    document.getElementById('tfitInfoBtn')?.addEventListener('click', () => modal?.classList.add('tfit-modal--open'));
    document.getElementById('tfitModalClose')?.addEventListener('click', () => modal?.classList.remove('tfit-modal--open'));
    modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('tfit-modal--open'); });

    this._bindAppRows();

    this.container.querySelectorAll('.tfit-domain-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.querySelector('.tfit-domain-name')?.textContent;
        const filtered = name ? this.apps.filter(a => a.domain === name) : this.apps;
        const table = document.getElementById('tfitTable');
        if (table) { table.innerHTML = renderAppTable(filtered); this._bindAppRows(); }
      });
    });

    const search = document.getElementById('tfitSearch');
    search?.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      const filtered = this.apps.filter(a => a.name.toLowerCase().includes(q) || a.domain.toLowerCase().includes(q));
      const table = document.getElementById('tfitTable');
      if (table) { table.innerHTML = renderAppTable(filtered); this._bindAppRows(); }
    });
  }

  _bindAppRows() {
    this.container.querySelectorAll('.tfit-app-row').forEach(row => {
      row.addEventListener('click', () => {
        const app = this.apps.find(a => a.id === row.dataset.id);
        const panel = document.getElementById('tfitDetail');
        if (app && panel) panel.innerHTML = renderDetail(app);
      });
    });
  }
}
