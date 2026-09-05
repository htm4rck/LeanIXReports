/**
 * 4. report.js — ORQUESTADOR
 */

import { BaseReport } from '@shared/index.js';
import { fetchLandscapeData } from './report.query.js';
import { CATEGORY_META, FUNCTIONAL_AREA_META, TAB_LABELS, ZONE_META, processLandscapeData } from './report.calc.js';
import { renderShell } from './report.render.js';

export class SoftwareLandscapeReport extends BaseReport {
  constructor(setup) {
    super(setup);
    this.model = null;
    this.activeTab = 'landscape';
    this.selectedItemId = null;
  }

  async loadData() {
    this.showLoading('Cargando landscape de software...');
    try {
      const raw = await fetchLandscapeData();
      this.model = processLandscapeData(raw);
      this.render();
    } catch (error) {
      this.showError(error);
    }
  }

  render() {
    if (!this.model) return;
    this.container.innerHTML = renderShell(this.model, this.activeTab);
    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.tab;
        this.render();
      });
    });

    this.container.querySelectorAll('.slr-item[data-item-ids]').forEach(card => {
      card.addEventListener('click', () => {
        const itemIds = (card.dataset.itemIds || '').split(',').filter(Boolean);
        if (!itemIds.length) return;
        this.openDetailPanel(itemIds[0]);
      });
    });

    if (this.activeTab === 'landscape' && this.selectedItemId) {
      this.openDetailPanel(this.selectedItemId);
    }
  }

  openDetailPanel(itemId) {
    const item = this.findItemById(itemId);
    if (!item) return;

    this.selectedItemId = itemId;
    this.highlightSelectedCard(itemId);
    this.container.querySelector('.slr-aside')?.remove();

    const panel = document.createElement('aside');
    panel.className = 'slr-aside';
    panel.innerHTML = `
      <div class="slr-aside-header" style="border-color:${CATEGORY_META[item.assetCategory]?.color || '#dfe8f4'}">
        <div class="slr-aside-icon" style="background:${CATEGORY_META[item.assetCategory]?.color || '#64748b'}">${this.getItemIcon(item)}</div>
        <div class="slr-aside-title">
          <div class="slr-aside-name">${this.escape(item.name || item.fullName || '')}</div>
          <div class="slr-aside-type">${this.escape(this.getItemTypeLabel(item))}</div>
        </div>
        <button class="slr-aside-close" type="button">×</button>
      </div>
      <div class="slr-aside-body">${this.renderDetailBody(item)}</div>
      <div class="slr-aside-footer">
        <button class="slr-aside-link" type="button" data-path="${this.escape(this.getFactSheetPath(item))}">Ver en LeanIX</button>
        <button class="slr-aside-copy" type="button" data-href="${this.escape(this.getFactSheetUrl(item))}">Copiar URL</button>
      </div>
    `;

    this.container.querySelector('.slr').appendChild(panel);

    panel.querySelector('.slr-aside-close')?.addEventListener('click', () => {
      this.selectedItemId = null;
      this.clearSelectedCard();
      panel.remove();
    });
    panel.querySelector('.slr-aside-link')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.openLeanixLink(event.currentTarget.dataset.path);
    });
    panel.querySelector('.slr-aside-copy')?.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      const button = event.currentTarget;
      await this.copyToClipboard(button.dataset.href || '');
      button.textContent = 'URL copiada';
      window.setTimeout(() => { button.textContent = 'Copiar URL'; }, 1800);
    });
    panel.querySelectorAll('[data-detail-id]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.openDetailPanel(event.currentTarget.dataset.detailId);
      });
    });
  }

  highlightSelectedCard(itemId) {
    this.clearSelectedCard();
    const card = [...this.container.querySelectorAll('.slr-item[data-item-ids]')]
      .find(node => (node.dataset.itemIds || '').split(',').includes(itemId));
    if (card) {
      card.classList.add('is-selected');
    }
  }

  clearSelectedCard() {
    this.container.querySelectorAll('.slr-item.is-selected').forEach(card => {
      card.classList.remove('is-selected');
    });
  }

  findItemById(itemId) {
    return this.model?.applications.find(item => item.id === itemId)
      || this.model?.itComponents.find(item => item.id === itemId)
      || null;
  }

  getItemIcon(item) {
    return {
      application: 'A',
      component: 'C',
      tool: 'H',
      platform: 'P',
    }[item.assetCategory] || 'I';
  }

  getItemTypeLabel(item) {
    return CATEGORY_META[item.assetCategory]?.label || item.kind;
  }

  getFactSheetPath(item) {
    const factSheetType = item.kind === 'application'
      ? 'Application'
      : item.kind === 'tool'
        ? 'Tool'
        : 'ITComponent';
    return `/factsheet/${factSheetType}/${item.id}`;
  }

  getFactSheetUrl(item) {
    return `${this.setup?.settings?.baseUrl || ''}${this.getFactSheetPath(item)}`;
  }

  openLeanixLink(path) {
    if (!path) return;
    try {
      if (window.lx?.openLink) {
        window.lx.openLink(path);
        return;
      }
    } catch (error) {
      console.warn('No se pudo abrir con lx.openLink', error);
    }
    this.copyToClipboard(`${this.setup?.settings?.baseUrl || ''}${path}`);
  }

  async copyToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  renderDetailBody(item) {
    const field = (label, value) => value
      ? `<div class="slr-aside-field"><span class="slr-aside-label">${this.escape(label)}</span><span class="slr-aside-value">${this.escape(String(value))}</span></div>`
      : '';
    const fieldHtml = (label, html) => html
      ? `<div class="slr-aside-field"><span class="slr-aside-label">${this.escape(label)}</span><div class="slr-aside-value">${html}</div></div>`
      : '';
    const chips = (items, tone = '#64748b') => items?.length
      ? items.map(name => `<span class="slr-aside-chip" style="--chip-color:${tone}">${this.escape(name)}</span>`).join('')
      : '';
    const organizations = item.organizations?.length
      ? chips(item.organizations, '#0f766e')
      : '<span class="slr-aside-muted">Sin organización relacionada</span>';
    const providers = item.providers?.length
      ? chips(item.providers.map(provider => provider.name), '#7c3aed')
      : '';
    const relatedComponents = item.relatedItComponents?.length
      ? `<div class="slr-aside-list">${item.relatedItComponents.map(child => `
          <button class="slr-aside-list-item" type="button" data-detail-id="${this.escape(child.id)}">
            <strong>${this.escape(child.name || '')}</strong>
            <span>Componente TI relacionado</span>
          </button>
        `).join('')}</div>`
      : '';
    const childApps = item.childApps?.length
      ? `<div class="slr-aside-list">${item.childApps.map(child => `
          <button class="slr-aside-list-item" type="button" data-detail-id="${this.escape(child.id)}">
            <strong>${this.escape(child.name || '')}</strong>
            <span>Aplicación hija</span>
          </button>
        `).join('')}</div>`
      : item.kind === 'application'
        ? '<span class="slr-aside-muted">Sin aplicaciones hijas directas</span>'
        : '';
    const societyLabel = item.society === 'Alicorp Peru' ? 'Alicorp Perú' : item.society;
    const zoneLabel = ZONE_META[item.zone]?.label || item.zone;
    const areaLabel = item.functionalArea ? FUNCTIONAL_AREA_META[item.functionalArea] : '';
    const tabLabel = TAB_LABELS[this.activeTab] || 'Landscape';

    return [
      field('Vista', tabLabel),
      field('Sociedad', societyLabel),
      field('Gobierno', item.governance || ''),
      field('Zona', zoneLabel),
      field('Área funcional', areaLabel),
      field('Canal', item.channel || ''),
      field('Arquitectura', item.architecture || ''),
      field('Padre aplicación', item.parentName || ''),
      field('Padre TI', item.parentComponentName || item.alignmentParent || ''),
      providers ? fieldHtml('Proveedor', providers) : '',
      fieldHtml('Organizaciones', organizations),
      item.tags?.length ? fieldHtml('Tags', chips(item.tags, CATEGORY_META[item.assetCategory]?.color || '#64748b')) : '',
      item.description ? field('Descripción', item.description) : '',
      relatedComponents ? fieldHtml('Componentes relacionados', relatedComponents) : '',
      fieldHtml('Hijos directos', childApps),
    ].join('');
  }

  escape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
