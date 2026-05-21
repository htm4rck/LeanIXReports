import { escapeHtml } from './helpers.js';

export class BaseReport {
  constructor(setup) {
    this.setup = setup;
    this.container = document.getElementById('report');
  }

  showLoading(message = 'Cargando...') {
    this.container.innerHTML =
      `<div class="loading"><div class="spinner"></div><p>${escapeHtml(message)}</p></div>`;
  }

  showError(error) {
    console.error(error);
    this.container.innerHTML =
      `<div class="error-msg"><p>Error al cargar datos</p><pre>${escapeHtml(JSON.stringify(error, null, 2))}</pre></div>`;
  }

  showEmpty(message = 'No se encontraron resultados.') {
    this.container.innerHTML = `<p class="empty-msg">${escapeHtml(message)}</p>`;
  }
}
