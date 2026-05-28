import { BaseReport, escapeHtml, getShortName, graphQL } from '@shared/index.js';
import { exportPDF, exportPPTX } from './export.js';

const LAYERS = [
  { key: 'metas', label: 'Metas', color: '#16a34a', icon: '◆' },
  { key: 'objetivos', label: 'Objetivos', color: '#22c55e', icon: '◇' },
  { key: 'capability', label: 'Capacidades', color: '#f59e0b', icon: '▣' },
  { key: 'application', label: 'Aplicaciones', color: '#a855f7', icon: '⬡' },
  { key: 'itcomponent', label: 'Componentes TI', color: '#06b6d4', icon: '⬢' },
  { key: 'dataobject', label: 'Objetos de Datos', color: '#4f46e5', icon: '◈' },
];

export class StrategicMapReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.objectives = [];
    this.misionVisions = [];
    this.selectedMV = null;
    this.data = {};
    this.relations = [];
  }

  async loadData() {
    this.showLoading('Cargando Mapa Estratégico...');

    try {
      // Load all objectives with hierarchy and relations
      const objQ = `{ allFactSheets(factSheetType: Objective) { edges { node { id displayName description type tags { name }
        ... on Objective {
          Tipo
          Principio
          relToParent { edges { node { factSheet { id } } } }
          relToChild { edges { node { factSheet { id } } } }
          relObjectiveToOrganization { edges { node { factSheet { id displayName } } } }
          relObjectiveToBusinessCapability { edges { node { factSheet { id } } } }
        }
      } } } }`;

      const objResult = await graphQL(objQ);
      this.objectives = objResult.allFactSheets.edges.map(e => ({
        id: e.node.id,
        name: getShortName(e.node.displayName),
        fullName: e.node.displayName,
        description: e.node.description || '',
        principio: e.node.Principio || '',
        tipo: e.node.Tipo,
        tags: e.node.tags?.map(t => t.name) || [],
        parentId: e.node.relToParent?.edges?.[0]?.node?.factSheet?.id || null,
        childIds: (e.node.relToChild?.edges || []).map(re => re.node.factSheet.id),
        orgName: e.node.relObjectiveToOrganization?.edges?.[0]?.node?.factSheet?.displayName || '',
        capIds: (e.node.relObjectiveToBusinessCapability?.edges || []).map(re => re.node.factSheet.id),
      }));

      // Filter MisionYVision as top-level filter options
      this.misionVisions = this.objectives.filter(o => o.tipo === 'MisionYVision');

      // Load capabilities, apps, components, data
      const [caps, apps, its, dos] = await Promise.all([
        this.fetchCaps(),
        this.fetchApps(),
        this.fetchITs(),
        this.fetchDOs(),
      ]);

      this.allCaps = caps;
      this.allApps = apps;
      this.allITs = its;
      this.allDOs = dos;

      // Select first MV by default
      if (this.misionVisions.length > 0) {
        this.selectedMV = this.misionVisions[0];
      }

      this.filterAndRender();
    } catch (error) {
      this.showError(error);
    }
  }

  async fetchCaps() {
    const q = `{ allFactSheets(factSheetType: BusinessCapability) { edges { node { id displayName tags { name } ... on BusinessCapability { externalId { externalId } relBusinessCapabilityToApplication { edges { node { factSheet { id } } } } } } } } }`;
    const r = await graphQL(q);
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id, name: getShortName(e.node.displayName), code: e.node.externalId?.externalId || '',
      appIds: (e.node.relBusinessCapabilityToApplication?.edges || []).map(re => re.node.factSheet.id),
    }));
  }

  async fetchApps() {
    const q = `{ allFactSheets(factSheetType: Application) { edges { node { id displayName tags { name } ... on Application { externalId { externalId } relApplicationToITComponent { edges { node { factSheet { id } } } } relApplicationToDataObject { edges { node { factSheet { id } } } } } } } } }`;
    const r = await graphQL(q);
    return r.allFactSheets.edges.map(e => ({
      id: e.node.id, name: getShortName(e.node.displayName), code: e.node.externalId?.externalId || '',
      itIds: (e.node.relApplicationToITComponent?.edges || []).map(re => re.node.factSheet.id),
      doIds: (e.node.relApplicationToDataObject?.edges || []).map(re => re.node.factSheet.id),
    }));
  }

  async fetchITs() {
    const q = `{ allFactSheets(factSheetType: ITComponent) { edges { node { id displayName tags { name } ... on ITComponent { externalId { externalId } } } } } }`;
    const r = await graphQL(q);
    return r.allFactSheets.edges.map(e => ({ id: e.node.id, name: getShortName(e.node.displayName), code: e.node.externalId?.externalId || '' }));
  }

  async fetchDOs() {
    const q = `{ allFactSheets(factSheetType: DataObject) { edges { node { id displayName tags { name } ... on DataObject { externalId { externalId } } } } } }`;
    const r = await graphQL(q);
    return r.allFactSheets.edges.map(e => ({ id: e.node.id, name: getShortName(e.node.displayName), code: e.node.externalId?.externalId || '' }));
  }

  // Filter data based on selected MisionYVision
  filterAndRender() {
    if (!this.selectedMV) {
      this.data = { metas: [], objetivos: [], capability: [], application: [], itcomponent: [], dataobject: [] };
      this.relations = [];
      this.render();
      return;
    }

    // Get Metas (children of selected MV)
    const metas = this.objectives.filter(o => o.parentId === this.selectedMV.id);

    // Get Objetivos (children of metas)
    const metaIds = new Set(metas.map(m => m.id));
    const objetivos = this.objectives.filter(o => metaIds.has(o.parentId));

    // Get Capabilities linked to objetivos
    const capIds = new Set(objetivos.flatMap(o => o.capIds));
    const caps = this.allCaps.filter(c => capIds.has(c.id));

    // Get Apps linked to those capabilities
    const appIds = new Set(caps.flatMap(c => c.appIds));
    const apps = this.allApps.filter(a => appIds.has(a.id));

    // Get ITComponents linked to those apps
    const itIds = new Set(apps.flatMap(a => a.itIds));
    const its = this.allITs.filter(i => itIds.has(i.id));

    // Get DataObjects linked to those apps
    const doIds = new Set(apps.flatMap(a => a.doIds));
    const dos = this.allDOs.filter(d => doIds.has(d.id));

    this.data = { metas, objetivos, capability: caps, application: apps, itcomponent: its, dataobject: dos };

    // Build relations
    this.relations = [];
    // MV → Metas
    for (const meta of metas) {
      this.relations.push({ from: this.selectedMV.id, to: meta.id, fromLayer: 'mv', toLayer: 'metas' });
    }
    // Metas → Objetivos
    for (const obj of objetivos) {
      this.relations.push({ from: obj.parentId, to: obj.id, fromLayer: 'metas', toLayer: 'objetivos' });
    }
    // Objetivos → Capabilities
    for (const obj of objetivos) {
      for (const capId of obj.capIds) {
        if (capIds.has(capId)) this.relations.push({ from: obj.id, to: capId, fromLayer: 'objetivos', toLayer: 'capability' });
      }
    }
    // Capabilities → Apps
    for (const cap of caps) {
      for (const appId of cap.appIds) {
        if (appIds.has(appId)) this.relations.push({ from: cap.id, to: appId, fromLayer: 'capability', toLayer: 'application' });
      }
    }
    // Apps → ITComponents
    for (const app of apps) {
      for (const itId of app.itIds) {
        if (itIds.has(itId)) this.relations.push({ from: app.id, to: itId, fromLayer: 'application', toLayer: 'itcomponent' });
      }
      for (const doId of app.doIds) {
        if (doIds.has(doId)) this.relations.push({ from: app.id, to: doId, fromLayer: 'application', toLayer: 'dataobject' });
      }
    }

    this.render();
    this.bindEvents();
  }

  render() {
    const mv = this.selectedMV;
    const orgName = mv ? getShortName(mv.orgName) : '';
    const kpis = LAYERS.map(l => ({ label: l.label, count: this.data[l.key]?.length || 0, color: l.color }));

    this.container.innerHTML = `
      <div class="smap">
        <div class="smap-header">
          <div class="smap-title">
            <h1>Mapa Estratégico Relacional</h1>
            <span class="smap-sub">Alicorp — Arquitectura Empresarial</span>
          </div>
          <div class="smap-controls">
            <select id="smapFilter" class="smap-select">
              ${this.misionVisions.map(m => `<option value="${m.id}" ${m.id === mv?.id ? 'selected' : ''}>${m.orgName ? escapeHtml(getShortName(m.orgName)) : ''}</option>`).join('')}
              ${this.misionVisions.length === 0 ? '<option value="">Sin objetivos configurados</option>' : ''}
            </select>
            <button id="smapExportPDF" class="smap-btn smap-btn-pdf" title="Exportar PDF">📄 PDF</button>
            <button id="smapExportPPTX" class="smap-btn smap-btn-pptx" title="Exportar PowerPoint">📊 PPTX</button>
          </div>
        </div>
        ${mv ? `
        <div class="smap-objective-bar">
          <div class="smap-obj-icon">🎯</div>
          <div class="smap-obj-info">
            <div class="smap-obj-name">${escapeHtml(mv.name)}</div>
            <div class="smap-obj-org">${escapeHtml(orgName)}</div>
          </div>
          <div class="smap-kpis">
            ${kpis.map(k => `<div class="smap-kpi"><span class="smap-kpi-count" style="color:${k.color}">${k.count}</span><span class="smap-kpi-label">${k.label}</span></div>`).join('')}
          </div>
        </div>
        ${mv.description || mv.principio ? `
        <div class="smap-details">
          ${mv.description ? `<div class="smap-detail-section">
            <div class="smap-detail-label">Misión y Visión</div>
            <div class="smap-detail-content">${this.formatDescription(mv.description)}</div>
          </div>` : ''}
          ${mv.principio ? `<div class="smap-detail-section">
            <div class="smap-detail-label">Principios</div>
            <div class="smap-principles">${this.formatPrinciples(mv.principio)}</div>
          </div>` : ''}
        </div>` : ''}
        ` : ''}
        <div class="smap-canvas" id="smapCanvas">
          <svg class="smap-svg" id="smapSvg"></svg>
          <div class="smap-layers" id="smapLayers">
            ${LAYERS.map(layer => this.renderLayer(layer)).join('')}
          </div>
        </div>
        ${this.data.metas?.length === 0 && this.data.objetivos?.length === 0 ? `
        <div class="smap-empty">
          <p>⚠️ No hay datos vinculados a este objetivo.</p>
          <p>Vincula Objetivos (nivel 3) con Business Capabilities en LeanIX para ver el mapa.</p>
        </div>` : ''}
      </div>`;

    requestAnimationFrame(() => this.drawLines());
  }

  renderLayer(layer) {
    const items = this.data[layer.key] || [];
    if (items.length === 0) return '';
    return `<div class="smap-layer" data-layer="${layer.key}">
      <div class="smap-layer-label" style="--layer-color:${layer.color}">
        <span class="smap-layer-icon">${layer.icon}</span>
        <span>${layer.label}</span>
        <span class="smap-layer-count">${items.length}</span>
      </div>
      <div class="smap-layer-cards">
        ${items.map(item => this.renderCard(item, layer)).join('')}
      </div>
    </div>`;
  }

  renderCard(item, layer) {
    const name = item.name || '';
    const code = item.code || '';
    return `<div class="smap-card" data-id="${item.id}" data-layer="${layer.key}" style="--card-color:${layer.color}">
      <div class="smap-card-icon" style="background:${layer.color}">${layer.icon}</div>
      <div class="smap-card-body">
        <div class="smap-card-name">${escapeHtml(name)}</div>
        ${code ? `<div class="smap-card-code">${escapeHtml(code)}</div>` : ''}
      </div>
    </div>`;
  }

  // Format description: split Misión/Visión into compact blocks
  formatDescription(desc) {
    const parts = desc.split(/\n+/).filter(p => p.trim());
    return parts.map(p => {
      const trimmed = p.trim();
      if (trimmed.startsWith('Misión:')) return `<span class="smap-desc-tag smap-desc-mision">Misión</span><span class="smap-desc-text">${escapeHtml(trimmed.replace('Misión:', '').trim())}</span>`;
      if (trimmed.startsWith('Visión:')) return `<span class="smap-desc-tag smap-desc-vision">Visión</span><span class="smap-desc-text">${escapeHtml(trimmed.replace('Visión:', '').trim())}</span>`;
      return `<span class="smap-desc-text">${escapeHtml(trimmed)}</span>`;
    }).join('');
  }

  // Format principles: split by bullet points into chips
  formatPrinciples(text) {
    const items = text.split(/[•\n]+/).filter(p => p.trim());
    return items.map(item => {
      const parts = item.split('|');
      const name = parts[0]?.trim() || '';
      const category = parts[1]?.split(':')[0]?.trim() || '';
      if (!name) return '';
      return `<div class="smap-principle-chip">${category ? `<span class="smap-principle-cat">${escapeHtml(category)}</span>` : ''}${escapeHtml(name)}</div>`;
    }).join('');
  }

  drawLines() {
    const svg = this.container.querySelector('#smapSvg');
    const canvas = this.container.querySelector('#smapCanvas');
    if (!svg || !canvas) return;

    svg.setAttribute('width', canvas.scrollWidth);
    svg.setAttribute('height', canvas.scrollHeight);
    svg.innerHTML = '';

    const canvasRect = canvas.getBoundingClientRect();

    for (const rel of this.relations) {
      const fromEl = canvas.querySelector(`[data-id="${rel.from}"]`);
      const toEl = canvas.querySelector(`[data-id="${rel.to}"]`);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left + canvas.scrollLeft;
      const y1 = fromRect.bottom - canvasRect.top + canvas.scrollTop;
      const x2 = toRect.left + toRect.width / 2 - canvasRect.left + canvas.scrollLeft;
      const y2 = toRect.top - canvasRect.top + canvas.scrollTop;

      const layerDef = LAYERS.find(l => l.key === rel.fromLayer);
      const color = layerDef?.color || '#94a3b8';

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midY = (y1 + y2) / 2;
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-opacity', '0.25');
      path.setAttribute('data-from', rel.from);
      path.setAttribute('data-to', rel.to);
      svg.appendChild(path);
    }
  }

  bindEvents() {
    // Filter change
    const select = this.container.querySelector('#smapFilter');
    if (select) {
      select.addEventListener('change', () => {
        this.selectedMV = this.misionVisions.find(m => m.id === select.value) || null;
        this.filterAndRender();
      });
    }

    // Export buttons
    const pdfBtn = this.container.querySelector('#smapExportPDF');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => {
        const orgName = this.selectedMV?.orgName ? getShortName(this.selectedMV.orgName) : 'Alicorp';
        exportPDF(this.data, this.selectedMV, orgName);
      });
    }
    const pptxBtn = this.container.querySelector('#smapExportPPTX');
    if (pptxBtn) {
      pptxBtn.addEventListener('click', () => {
        const orgName = this.selectedMV?.orgName ? getShortName(this.selectedMV.orgName) : 'Alicorp';
        exportPPTX(this.data, this.selectedMV, orgName, this.relations);
      });
    }

    const canvas = this.container.querySelector('#smapCanvas');
    if (!canvas) return;

    // Hover highlight
    canvas.addEventListener('mouseenter', (e) => {
      const card = e.target.closest('.smap-card');
      if (card) this.highlightRelations(card.dataset.id);
    }, true);
    canvas.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.smap-card');
      if (card) this.clearHighlight();
    }, true);

    // Click → open detail aside panel
    canvas.addEventListener('click', (e) => {
      const card = e.target.closest('.smap-card');
      if (card) {
        const id = card.dataset.id;
        const layer = card.dataset.layer;
        this.openDetailPanel(id, layer);
      }
    });

    // Redraw on scroll/resize
    canvas.addEventListener('scroll', () => this.drawLines());
    window.addEventListener('resize', () => this.drawLines());
  }

  openDetailPanel(id, layer) {
    const typeMap = { metas: 'Objective', objetivos: 'Objective', capability: 'BusinessCapability', application: 'Application', itcomponent: 'ITComponent', dataobject: 'DataObject' };
    const type = typeMap[layer] || 'Objective';
    const layerDef = LAYERS.find(l => l.key === layer);

    // Find item in data
    let item = null;
    if (layer === 'metas' || layer === 'objetivos') {
      item = this.objectives.find(o => o.id === id);
    } else {
      item = (this.data[layer] || []).find(i => i.id === id);
    }
    if (!item) return;

    // Find relations
    const relatedTo = this.relations.filter(r => r.from === id).map(r => r.to);
    const relatedFrom = this.relations.filter(r => r.to === id).map(r => r.from);

    // Remove existing panel
    const existing = this.container.querySelector('.smap-aside');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'smap-aside';
    panel.innerHTML = `
      <div class="smap-aside-header" style="border-color:${layerDef?.color || '#e2e8f0'}">
        <div class="smap-aside-icon" style="background:${layerDef?.color || '#64748b'}">${layerDef?.icon || '◆'}</div>
        <div class="smap-aside-title">
          <div class="smap-aside-name">${escapeHtml(item.name || item.fullName || '')}</div>
          <div class="smap-aside-type">${escapeHtml(layerDef?.label || type)}</div>
        </div>
        <button class="smap-aside-close">✕</button>
      </div>
      <div class="smap-aside-body">
        ${item.code ? `<div class="smap-aside-field"><span class="smap-aside-label">Código</span><span class="smap-aside-value">${escapeHtml(item.code)}</span></div>` : ''}
        ${item.description ? `<div class="smap-aside-field"><span class="smap-aside-label">Descripción</span><span class="smap-aside-value smap-aside-desc">${escapeHtml(item.description)}</span></div>` : ''}
        ${item.principio ? `<div class="smap-aside-field"><span class="smap-aside-label">Principio</span><span class="smap-aside-value smap-aside-desc">${escapeHtml(item.principio)}</span></div>` : ''}
        ${relatedTo.length > 0 ? `<div class="smap-aside-field"><span class="smap-aside-label">Relacionado con (${relatedTo.length})</span></div>` : ''}
        ${relatedFrom.length > 0 ? `<div class="smap-aside-field"><span class="smap-aside-label">Relacionado desde (${relatedFrom.length})</span></div>` : ''}
      </div>
      <div class="smap-aside-footer">
        <a class="smap-aside-link" href="https://br.leanix.net/AlicorpSAASandbox/factsheet/${type}/${id}" target="_top">Ver Factsheet →</a>
      </div>
    `;

    this.container.querySelector('.smap').appendChild(panel);

    // Close button
    panel.querySelector('.smap-aside-close').addEventListener('click', () => panel.remove());
  }

  highlightRelations(nodeId) {
    const svg = this.container.querySelector('#smapSvg');
    const canvas = this.container.querySelector('#smapCanvas');
    if (!svg || !canvas) return;

    // Walk relations to find all connected (multi-hop)
    const connected = new Set([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const rel of this.relations) {
        if (connected.has(rel.from) && !connected.has(rel.to)) { connected.add(rel.to); changed = true; }
        if (connected.has(rel.to) && !connected.has(rel.from)) { connected.add(rel.from); changed = true; }
      }
    }

    canvas.querySelectorAll('.smap-card').forEach(card => {
      card.classList.toggle('smap-card--dim', !connected.has(card.dataset.id));
      card.classList.toggle('smap-card--highlight', connected.has(card.dataset.id));
    });

    svg.querySelectorAll('path').forEach(path => {
      const isConn = connected.has(path.dataset.from) && connected.has(path.dataset.to);
      path.setAttribute('stroke-opacity', isConn ? '0.85' : '0.04');
      path.setAttribute('stroke-width', isConn ? '2.5' : '1');
    });
  }

  clearHighlight() {
    const svg = this.container.querySelector('#smapSvg');
    const canvas = this.container.querySelector('#smapCanvas');
    if (!svg || !canvas) return;
    canvas.querySelectorAll('.smap-card').forEach(card => {
      card.classList.remove('smap-card--dim', 'smap-card--highlight');
    });
    svg.querySelectorAll('path').forEach(path => {
      path.setAttribute('stroke-opacity', '0.25');
      path.setAttribute('stroke-width', '1.5');
    });
  }
}
