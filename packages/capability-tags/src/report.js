import { BaseReport, escapeHtml, getShortName, renderTags, graphQL } from '@shared/index.js';

export class CapabilityTagsReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.dataMap = {};
    this.allNodes = [];
    this.activeTagFilter = '';
    this.searchText = '';
  }

  async loadData() {
    this.showLoading('Cargando Capability Map...');

    const query = `{
      allFactSheets(factSheetType: BusinessCapability) {
        edges {
          node {
            id
            displayName
            description
            tags { id name }
            ... on BusinessCapability {
              relToParent { edges { node { factSheet { id } } } }
              relToChild { edges { node { factSheet { id displayName } } } }
            }
          }
        }
      }
    }`;

    try {
      const result = await graphQL(query);
      this.allNodes = result.allFactSheets.edges.map(e => e.node);
      this.allNodes.forEach(n => { this.dataMap[n.id] = n; });
      this.render();
    } catch (error) {
      this.showError(error);
    }
  }

  getAllTags() {
    const tagSet = new Set();
    this.allNodes.forEach(n => (n.tags || []).forEach(t => tagSet.add(t.name)));
    return [...tagSet].sort();
  }

  matchesFilter(cap) {
    const matchesSearch = !this.searchText ||
      cap.displayName.toLowerCase().includes(this.searchText.toLowerCase());
    const matchesTag = !this.activeTagFilter ||
      (cap.tags || []).some(t => t.name === this.activeTagFilter);
    return matchesSearch && matchesTag;
  }

  rootMatchesFilter(root) {
    if (this.matchesFilter(root)) return true;
    return (root.relToChild?.edges || []).some(e => {
      const child = this.dataMap[e.node.factSheet.id];
      return child && this.matchesFilter(child);
    });
  }

  render() {
    const roots = this.allNodes.filter(
      c => !c.relToParent || c.relToParent.edges.length === 0
    );
    const filtered = roots.filter(r => this.rootMatchesFilter(r));
    const allTags = this.getAllTags();

    this.container.innerHTML = `
      <div class="map-container">
        <div class="report-header">
          <div>
            <h1>Business Capability Map</h1>
            <p class="subtitle">Mapa de Capacidades de Negocio con Tags</p>
          </div>
          <div class="filters">
            <input type="text" id="searchInput" placeholder="Buscar capacidad..." value="${escapeHtml(this.searchText)}" />
            <select id="tagFilter">
              <option value="">Todos los tags</option>
              ${allTags.map(t => `<option value="${escapeHtml(t)}" ${this.activeTagFilter === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="capability-root-grid">
          ${filtered.length > 0
            ? filtered.map(root => this.renderRoot(root)).join('')
            : '<p class="empty-msg">No se encontraron resultados.</p>'}
        </div>
      </div>`;

    this.bindEvents();
  }

  bindEvents() {
    let timer;
    document.getElementById('searchInput').addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { this.searchText = e.target.value; this.render(); }, 300);
    });
    document.getElementById('tagFilter').addEventListener('change', e => {
      this.activeTagFilter = e.target.value;
      this.render();
    });
  }

  renderRoot(root) {
    const children = (root.relToChild?.edges || []).filter(e => {
      const child = this.dataMap[e.node.factSheet.id];
      return child && this.matchesFilter(child);
    });

    return `
      <div class="root-capability">
        <div class="root-header">
          <div class="root-title">${escapeHtml(root.displayName)}</div>
          <span class="root-badge">${children.length}</span>
        </div>
        ${(root.tags || []).length > 0 ? `<div class="root-tags">${renderTags(root.tags)}</div>` : ''}
        <div class="children-grid">
          ${children.map(e => this.renderChild(e.node.factSheet.id)).join('')}
        </div>
      </div>`;
  }

  renderChild(childId) {
    const cap = this.dataMap[childId];
    if (!cap) return '';

    const subChildren = cap.relToChild?.edges || [];
    const shortName = getShortName(cap.displayName);

    return `
      <div class="child-card">
        <div class="child-title" title="${escapeHtml(cap.description)}">${escapeHtml(shortName)}</div>
        ${renderTags(cap.tags)}
        ${subChildren.length > 0 ? `<div class="sub-children">
          ${subChildren.map(e => {
            const name = getShortName(this.dataMap[e.node.factSheet.id]?.displayName || '');
            return `<span class="sub-child">${escapeHtml(name)}</span>`;
          }).join('')}
        </div>` : ''}
      </div>`;
  }
}
