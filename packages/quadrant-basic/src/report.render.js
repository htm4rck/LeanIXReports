/**
 * 3. report.render.js — CAPA DE PRESENTACIÓN
 *
 * Responsabilidad: generar HTML a partir de datos ya calculados.
 * Sin lógica de negocio, sin llamadas a LeanIX.
 */

import { escapeHtml } from '@shared/index.js';
import { getColor } from './report.calc.js';

// 3.1 Shell principal
export function renderShell() {
  return `
    <div class="qb">
      <h1 class="qb-title">Cuadrante de Salud — Aplicaciones</h1>
      <div class="qb-wrap">
        <canvas id="qbCanvas"></canvas>
        <div id="qbTooltip" class="qb-tooltip" hidden></div>
      </div>
    </div>`;
}

// 3.2 Tooltip al hacer hover sobre una burbuja
export function renderTooltip(app) {
  return `
    <strong>${escapeHtml(app.name)}</strong><br>
    Agilidad: ${app.agility} &nbsp; Resiliencia: ${app.resilience}`;
}
