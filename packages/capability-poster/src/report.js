import { BaseReport, escapeHtml, getShortName, graphQL } from '@shared/index.js';
import { LAYOUT_CONFIG, DOMAIN_COLORS } from './layout-config.js';

export class CapabilityPosterReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.dataMap = {};
    this.allNodes = [];
    this.trees = [];
    this.critFilter = '';
  }

  async loadData() {
    this.showLoading('Cargando Mapa de Capacidades...');

    const query = `{
      allFactSheets(factSheetType: BusinessCapability) {
        edges {
          node {
            id
            displayName
            description
            tags { id name }
            ... on BusinessCapability {
              externalId { externalId }
              relToParent { edges { node { factSheet { id } } } }
              relToChild { edges { node { factSheet { id displayName tags { id name } ... on BusinessCapability { externalId { externalId } } } } } }
            }
          }
        }
      }
    }`;

    try {
      const result = await graphQL(query);
      this.allNodes = result.allFactSheets.edges.map(e => e.node);
      this.allNodes.forEach(n => { this.dataMap[n.id] = n; });
      this.buildTrees();
      this.render();
      this.bindEvents();
    } catch (error) {
      this.showError(error);
    }
  }

  // â”€â”€â”€ Tree building â”€â”€â”€
  buildTrees() {
    const roots = this.allNodes.filter(n => !n.relToParent || n.relToParent.edges.length === 0);
    this.trees = roots.map(r => this.buildNode(r));
  }

  buildNode(node) {
    const childIds = (node.relToChild?.edges || []).map(e => e.node.factSheet.id);
    const children = childIds.map(id => this.dataMap[id]).filter(Boolean).map(c => this.buildNode(c));
    return { data: node, children };
  }

  getRoot(codigo) {
    // Find root where the tag matches AND prioritize exact match on first tag
    return this.trees.find(t => {
      const tags = (t.data.tags || []).map(tag => tag.name);
      return tags.includes(codigo);
    });
  }

  getRoots(codigo) {
    // Get ALL roots that have this tag
    return this.trees.filter(t => {
      const tags = (t.data.tags || []).map(tag => tag.name);
      return tags.includes(codigo);
    });
  }

  getCodigo(node) {
    const data = node.data || node;
    const ext = data.externalId?.externalId;
    if (ext) return ext;
    const tags = data.tags || [];
    for (const t of tags) {
      if (LAYOUT_CONFIG[t.name]) return t.name;
    }
    return '';
  }

  getNombre(node) {
    const dn = node.data?.displayName || node.displayName || '';
    return getShortName(dn);
  }

  // â”€â”€â”€ Domain chip logic (same as Angular) â”€â”€â”€
  collectDomains(tree) {
    const set = new Set();
    const tags = tree.data?.tags || [];
    for (const t of tags) {
      if (DOMAIN_COLORS[t.name]) set.add(t.name);
    }
    for (const child of tree.children || []) {
      for (const d of this.collectDomains(child)) set.add(d);
    }
    return set;
  }

  domainChipN0(n0) {
    const domains = this.collectDomains(n0);
    return domains.size === 1 ? [...domains][0] : null;
  }

  domainChipN1(n1, n0) {
    if (this.domainChipN0(n0) !== null) return null;
    const domains = this.collectDomains(n1);
    return domains.size === 1 ? [...domains][0] : null;
  }

  domainChipN2(n2, n1, n0) {
    const tags = n2.data?.tags || [];
    const d = tags.find(t => DOMAIN_COLORS[t.name]);
    if (!d) return null;
    if (this.domainChipN0(n0) !== null) return null;
    if (this.domainChipN1(n1, n0) !== null) return null;
    return d.name;
  }

  chipHtml(dominio) {
    if (!dominio) return '';
    const s = DOMAIN_COLORS[dominio] || { bg: '#f5f5f5', color: '#555', border: '#bbb' };
    return `<span class="dom-chip" style="background:${s.bg};color:${s.color};border-color:${s.border}">${escapeHtml(dominio)}</span>`;
  }

  getFactSheetUrl(id) {
    return `/factsheet/BusinessCapability/${id}`;
  }

  // â”€â”€â”€ KPIs (placeholder â€” no criticidad data from LeanIX yet) â”€â”€â”€
  getKpis() {
    // Future: compute from tags or custom fields
    return { total: 0, cortoAlto: 0, cortoMedio: 0, largoAlto: 0, largoMedio: 0, pctCorto: 0, pctLargo: 0 };
  }

  // â”€â”€â”€ Render â”€â”€â”€
  render() {
    const left = ['DTO', 'FTP', 'PTP', 'PTM'].map(c => this.getRoot(c)).filter(Boolean);
    const front = ['OTC'].map(c => this.getRoot(c)).filter(Boolean);
    const middle = ['PTD', 'MAI', 'Transversal-Soporte'].map(c => this.getRoot(c)).filter(Boolean);
    const right = ['TT'].map(c => this.getRoot(c)).filter(Boolean);

    const middleNarrow = middle.filter(r => { const c = this.getCodigo(r.data); return LAYOUT_CONFIG[c]?.mode === 'rows'; });
    const middleWide = middle.filter(r => { const c = this.getCodigo(r.data); return LAYOUT_CONFIG[c]?.mode === 'cols'; });

    this.container.innerHTML = `
      <div class="poster">
        <div class="poster-header">
          <div class="poster-title">
            <h1>Capacidades crÃ­ticas</h1>
            <span class="poster-sub">/ PRELIMINAR</span>
          </div>
          <select id="posterFilter" class="poster-filter">
            <option value="">Todas</option>
            <option value="any">ðŸ”¥ Solo crÃ­ticas</option>
            <option value="corto_alto">ðŸŸ  CP Alto</option>
            <option value="corto_medio">ðŸŸ¡ CP Medio</option>
            <option value="largo_alto">ðŸŸ£ LP Alto</option>
            <option value="largo_medio">ðŸ”® LP Medio</option>
            <option value="none">â¬œ Sin criticidad</option>
          </select>
        </div>
        <div class="layout-root">
          <div class="layout-left">
            ${left.map(r => this.renderBlockRows(r)).join('')}
          </div>
          <div class="layout-center">
            <div class="office-row">
              <div class="office-label">FRONT<br>OFFICE</div>
              <div class="office-blocks">
                <div class="office-wide">
                  ${front.map(r => this.renderBlockWide(r)).join('')}
                </div>
              </div>
            </div>
            <div class="office-row">
              <div class="office-label">MIDDLE<br>OFFICE</div>
              <div class="office-blocks">
                ${middleNarrow.map(r => this.renderBlockRows(r)).join('')}
                <div class="office-wide">
                  ${middleWide.map(r => this.renderBlockWide(r)).join('')}
                </div>
              </div>
            </div>
          </div>
          <div class="layout-right">
            ${right.map(r => this.renderBlockTransposed(r)).join('')}
          </div>
        </div>
      </div>`;
  }

  // â”€â”€â”€ Block: Rows (DTO, FTP, PTP, PTM, PTD, MAI) â”€â”€â”€
  renderBlockRows(root) {
    const codigo = this.getCodigo(root.data);
    const nombre = this.getNombre(root);
    const chip = this.chipHtml(this.domainChipN0(root));

    let cellsHtml = '';
    for (const n1 of root.children) {
      const hasN2 = n1.children.length > 0;
      if (hasN2) {
        if (root.children.length > 1) {
          const n1chip = this.chipHtml(this.domainChipN1(n1, root));
          cellsHtml += `<div class="blk-n1-row dom-anchor" data-id="${n1.data.id}">${escapeHtml(this.getCodigo(n1.data))} ${escapeHtml(this.getNombre(n1))} ${n1chip}</div>`;
        }
        for (const n2 of n1.children) {
          const n2chip = this.chipHtml(this.domainChipN2(n2, n1, root));
          cellsHtml += `<div class="cell dom-anchor" data-id="${n2.data.id}"><span class="cell-code">${escapeHtml(this.getCodigo(n2.data))}</span> ${escapeHtml(this.getNombre(n2))} ${n2chip}</div>`;
        }
      } else {
        // N1 without children â€” render as clickable cell
        const n1chip = this.chipHtml(this.domainChipN1(n1, root));
        const code = this.getCodigo(n1.data);
        cellsHtml += `<div class="cell dom-anchor" data-id="${n1.data.id}">${code ? `<span class="cell-code">${escapeHtml(code)}</span> ` : ''}${escapeHtml(this.getNombre(n1))} ${n1chip}</div>`;
      }
    }

    return `<div class="blk blk-rows">
      <div class="blk-title dom-anchor">${escapeHtml(codigo)} â€” ${escapeHtml(nombre)} ${chip}</div>
      ${cellsHtml}
    </div>`;
  }

  // â”€â”€â”€ Block: Wide columns (OTC, SOP) â”€â”€â”€
  renderBlockWide(root) {
    const codigo = this.getCodigo(root.data);
    const nombre = this.getNombre(root);
    const chip = this.chipHtml(this.domainChipN0(root));

    // Check if children have sub-children (N2)
    const hasN2 = root.children.some(n1 => n1.children.length > 0);

    if (hasN2) {
      // Standard: N1 as columns, N2 as cells
      let colsHtml = '';
      for (const n1 of root.children) {
        const n1chip = this.chipHtml(this.domainChipN1(n1, root));
        let cellsHtml = '';
        for (const n2 of n1.children) {
          const n2chip = this.chipHtml(this.domainChipN2(n2, n1, root));
          cellsHtml += `<div class="cell dom-anchor" data-id="${n2.data.id}"><span class="cell-code">${escapeHtml(this.getCodigo(n2.data))}</span> ${escapeHtml(this.getNombre(n2))} ${n2chip}</div>`;
        }
        colsHtml += `<div class="blk-col">
          <div class="blk-n1 dom-anchor">${escapeHtml(this.getCodigo(n1.data))} ${escapeHtml(this.getNombre(n1))} ${n1chip}</div>
          ${cellsHtml}
        </div>`;
      }
      return `<div class="blk blk-wide">
        <div class="blk-title dom-anchor">${escapeHtml(codigo)} â€” ${escapeHtml(nombre)} ${chip}</div>
        <div class="blk-cols">${colsHtml}</div>
      </div>`;
    }

    // No N2: group N1s by channel tag into columns
    const groups = this.groupByChannel(root.children);
    let colsHtml = '';
    for (const group of groups) {
      let cellsHtml = group.items.map(n1 => {
        const n1chip = this.chipHtml(this.domainChipN1(n1, root));
        const code = this.getCodigo(n1.data);
        return `<div class="cell dom-anchor" data-id="${n1.data.id}">${code ? `<span class="cell-code">${escapeHtml(code)}</span> ` : ''}${escapeHtml(this.getNombre(n1))} ${n1chip}</div>`;
      }).join('');
      colsHtml += `<div class="blk-col">
        <div class="blk-n1 dom-anchor">${escapeHtml(group.label)}</div>
        ${cellsHtml}
      </div>`;
    }
    return `<div class="blk blk-wide">
      <div class="blk-title dom-anchor">${escapeHtml(codigo)} â€” ${escapeHtml(nombre)} ${chip}</div>
      <div class="blk-cols">${colsHtml}</div>
    </div>`;
  }

  // Group nodes by channel tags
  groupByChannel(nodes) {
    const CHANNEL_TAGS = ['No Tradicional', 'Tradicional Vertical'];
    const groups = new Map();
    groups.set('AS - Alicorp Soluciones', { label: 'AS - Alicorp Soluciones', items: [] });
    groups.set('No Tradicional', { label: 'No Tradicional', items: [] });
    groups.set('Tradicional Vertical', { label: 'Tradicional Vertical', items: [] });

    for (const node of nodes) {
      const tags = (node.data?.tags || []).map(t => t.name);
      const channel = tags.find(t => CHANNEL_TAGS.includes(t));
      if (channel) {
        groups.get(channel).items.push(node);
      } else {
        groups.get('AS - Alicorp Soluciones').items.push(node);
      }
    }

    return [...groups.values()].filter(g => g.items.length > 0);
  }

  // â”€â”€â”€ Block: Transposed (TT) â”€â”€â”€
  renderBlockTransposed(root) {
    const codigo = this.getCodigo(root.data);
    const nombre = this.getNombre(root);
    const chip = this.chipHtml(this.domainChipN0(root));

    // Check if children have sub-children
    const hasN2 = root.children.some(n1 => n1.children.length > 0);

    let rowsHtml = '';
    if (hasN2) {
      // Standard: N1 as row labels, N2 as cells
      for (const n1 of root.children) {
        const n1chip = this.chipHtml(this.domainChipN1(n1, root));
        let cellsHtml = '';
        for (const n2 of n1.children) {
          const n2chip = this.chipHtml(this.domainChipN2(n2, n1, root));
          cellsHtml += `<div class="tcell dom-anchor">${escapeHtml(this.getNombre(n2))} ${n2chip}</div>`;
        }
        rowsHtml += `<div class="blk-trow">
          <div class="blk-trow-label dom-anchor">${escapeHtml(this.getNombre(n1))} ${n1chip}</div>
          <div class="blk-trow-cells">${cellsHtml}</div>
        </div>`;
      }
    } else {
      // No N2: group N1s by tag into rows
      const groups = this.groupByTag(root.children, codigo);
      for (const group of groups) {
        const cellsHtml = group.items.map(n1 => {
          const code = this.getCodigo(n1.data);
          return `<div class="tcell dom-anchor" data-id="${n1.data.id}">${code ? `<span class="cell-code">${escapeHtml(code)}</span> ` : ''}${escapeHtml(this.getNombre(n1))}</div>`;
        }).join('');
        rowsHtml += `<div class="blk-trow">
          <div class="blk-trow-label dom-anchor">${escapeHtml(group.label)}</div>
          <div class="blk-trow-cells">${cellsHtml}</div>
        </div>`;
      }
    }

    return `<div class="blk blk-transposed">
      <div class="blk-title dom-anchor">${escapeHtml(codigo)} â€” ${escapeHtml(nombre)} ${chip}</div>
      ${rowsHtml}
    </div>`;
  }

  // Group nodes by their non-root tag (excluding the root tag and known domain tags)
  groupByTag(nodes, rootTag) {
    const SKIP_TAGS = new Set([rootTag, 'TI']); // skip the root tag and generic domain
    const groups = new Map();

    for (const node of nodes) {
      const tags = (node.data?.tags || []).map(t => t.name);
      const groupTag = tags.find(t => !SKIP_TAGS.has(t)) || 'Otros';
      if (!groups.has(groupTag)) groups.set(groupTag, { label: groupTag, items: [] });
      groups.get(groupTag).items.push(node);
    }

    return [...groups.values()];
  }

  // â”€â”€â”€ Events â”€â”€â”€
  bindEvents() {
    const filter = this.container.querySelector('#posterFilter');
    if (filter) {
      filter.addEventListener('change', () => {
        this.critFilter = filter.value;
      });
    }

    // Click on any cell/tcell -> open factsheet via LeanIX navigation
    this.container.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-id]');
      if (cell) {
        this.openLeanixLink(this.getFactSheetUrl(cell.dataset.id));
      }
    });
  }

  openLeanixLink(path) {
    if (!path) return;
    try {
      if (window.lx?.openLink) {
        window.lx.openLink(path);
      }
    } catch (error) {
      console.warn('No se pudo abrir con lx.openLink', error);
    }
  }
}
