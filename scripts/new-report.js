const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) {
  console.error('Uso: node scripts/new-report.js <nombre-del-reporte>');
  process.exit(1);
}

const dir     = path.resolve(__dirname, '..', 'packages', name);
const srcDir  = path.join(dir, 'src');
const assetsDir = path.join(srcDir, 'assets');

fs.mkdirSync(assetsDir, { recursive: true });

// ── package.json ──────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
  name: `@leanix-reports/${name}`,
  version: '1.0.0',
  description: `LeanIX Report: ${name}`,
  private: true,
  leanixReport: {
    id: `pe.com.alicorp.${name.replace(/-/g, '')}`,
    title: name,
    defaultConfig: {},
  },
  leanixReportingCli: { distPath: 'dist', buildCommand: 'npx webpack' },
  scripts: { build: 'lxr build', start: 'lxr start', upload: 'lxr upload' },
  dependencies: {
    '@leanix/reporting': '^0.4.148',
    '@leanix-reports/shared': '*',
  },
}, null, 2));

// ── webpack.config.js ─────────────────────────────────────────────────────────
fs.writeFileSync(path.join(dir, 'webpack.config.js'),
  "var createWebpackConfig = require('../../config/webpack.base');\nmodule.exports = createWebpackConfig(__dirname);\n"
);

// ── src/index.html ────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(srcDir, 'index.html'),
  `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${name}</title>\n  </head>\n  <body><div id="report"></div></body>\n</html>\n`
);

// ── src/index.js ──────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(srcDir, 'index.js'),
  "/**\n * index.js — ENTRY POINT\n *\n * Solo inicializa LeanIX e instancia el reporte.\n * No agregar lógica aquí.\n */\nimport '@leanix/reporting';\nimport '@shared/styles/base.css';\nimport './assets/report.css';\nimport { Report } from './report.js';\n\nlx.init().then(setup => new Report(setup).loadData());\n"
);

// ── src/report.query.js ───────────────────────────────────────────────────────
fs.writeFileSync(path.join(srcDir, 'report.query.js'),
  "/**\n * report.query.js — CAPA DE DATOS\n *\n * Responsabilidad única: comunicarse con LeanIX.\n * - Define la query GraphQL con los campos que necesita este reporte.\n * - Transforma la respuesta cruda en objetos simples del dominio.\n *\n * Regla: ninguna lógica de negocio aquí.\n * Si un campo cambia en LeanIX, solo se toca este archivo.\n *\n * Flujo: index.js → report.js → [fetchData()] → report.calc.js\n */\nimport { graphQL, getShortName } from '@shared/index.js';\n\n// 1. Query GraphQL: declara exactamente qué campos necesita el reporte.\nconst QUERY = `{\n  allFactSheets(factSheetType: Application) {\n    edges { node { id displayName } }\n  }\n}`;\n\n// 2. Ejecuta la query y transforma cada nodo crudo en un objeto de dominio.\n//    El resto del reporte solo trabaja con estos objetos, nunca con el raw.\nexport async function fetchData() {\n  const result = await graphQL(QUERY);\n\n  // 3. Mapeo: nodo GraphQL → objeto de dominio\n  return result.allFactSheets.edges.map(({ node: n }) => ({\n    id:   n.id,\n    name: getShortName(n.displayName),\n    // TODO: agregar más campos según necesite el reporte\n  }));\n}\n"
);

// ── src/report.calc.js ────────────────────────────────────────────────────────
fs.writeFileSync(path.join(srcDir, 'report.calc.js'),
  "/**\n * report.calc.js — CAPA DE LÓGICA DE NEGOCIO\n *\n * Responsabilidad única: cálculos, scoring y constantes del reporte.\n * - No sabe nada de DOM, HTML ni GraphQL.\n * - Todas las funciones son puras: misma entrada → misma salida.\n *\n * Regla: si cambian los criterios de evaluación, solo se toca este archivo.\n *\n * Flujo: report.query.js → [processData()] → report.render.js\n */\n\n// 1. Constantes de configuración del reporte.\n//    Centralizar aquí facilita ajustes sin buscar en el código.\nexport const CONFIG = {\n  // TODO: definir constantes del reporte\n};\n\n// 2. Transforma y enriquece los objetos de dominio con cálculos derivados.\n//    Recibe: array de objetos de dominio (salida de report.query.js).\n//    Retorna: mismo array con campos adicionales calculados.\nexport function processData(items) {\n  // TODO: implementar lógica de negocio\n  return items;\n}\n"
);

// ── src/report.render.js ──────────────────────────────────────────────────────
fs.writeFileSync(path.join(srcDir, 'report.render.js'),
  "/**\n * report.render.js — CAPA DE PRESENTACIÓN\n *\n * Responsabilidad única: construir el HTML del reporte.\n * - Todas las funciones reciben datos y retornan strings HTML.\n * - No ejecuta queries, no calcula scores, no manipula el DOM directamente.\n *\n * Regla: si cambia el diseño o la estructura visual, solo se toca este archivo.\n *\n * Flujo: report.calc.js → [renderShell()] → report.js (innerHTML)\n */\nimport { escapeHtml } from '@shared/index.js';\n\n// 1. Renderiza el esqueleto completo del reporte.\n//    Es el único punto de entrada público para el render inicial.\n//    Recibe: lista de items ya procesados (salida de report.calc.js).\nexport function renderShell(items) {\n  return `<div class=\"report\">\n    <h1>TODO: título del reporte</h1>\n    <ul>${items.map(i => `<li>${escapeHtml(i.name)}</li>`).join('')}</ul>\n  </div>`;\n}\n\n// 2. Renderiza el panel de detalle de un item seleccionado.\n//    Se inyecta en el DOM cuando el usuario hace clic en un elemento.\nexport function renderDetail(item) {\n  return `<div class=\"detail\">\n    <strong>${escapeHtml(item.name)}</strong>\n    <!-- TODO: agregar campos de detalle -->\n  </div>`;\n}\n"
);

// ── src/report.js ─────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(srcDir, 'report.js'),
  "/**\n * report.js — ORQUESTADOR\n *\n * Responsabilidad única: coordinar el ciclo de vida del reporte.\n * - Mantiene el estado de la UI.\n * - Llama a query → calc → render en el orden correcto.\n * - Gestiona los eventos DOM.\n * - No contiene lógica de negocio ni strings HTML largos.\n *\n * Ciclo de vida:\n *   1. lx.init()       → index.js instancia esta clase\n *   2. loadData()      → fetchData() + processData() → render()\n *   3. render()        → renderShell() → bindEvents()\n *   4. [interacción]   → estado cambia → render() de nuevo\n */\nimport { BaseReport } from '@shared/index.js';\nimport { fetchData } from './report.query.js';\nimport { processData } from './report.calc.js';\nimport { renderShell, renderDetail } from './report.render.js';\n\nexport class Report extends BaseReport {\n  constructor(setup) {\n    super(setup);\n    this.items = []; // lista completa de items cargados y procesados\n  }\n\n  // ── Paso 1: Carga de datos ────────────────────────────────────────────────\n  // Llama a la capa de query, aplica procesamiento y dispara el render.\n  async loadData() {\n    this.showLoading();\n    try {\n      // 1a. Obtiene objetos de dominio limpios desde LeanIX\n      const raw = await fetchData();\n\n      // 1b. Enriquece con cálculos derivados\n      this.items = processData(raw);\n\n      this.render();\n    } catch (error) {\n      this.showError(error);\n    }\n  }\n\n  // ── Paso 2: Render ────────────────────────────────────────────────────────\n  // Reconstruye el HTML completo y registra los eventos.\n  // Se llama también cada vez que cambia el estado de la UI.\n  render() {\n    this.container.innerHTML = renderShell(this.items);\n    this.bindEvents();\n  }\n\n  // ── Paso 3: Eventos DOM ───────────────────────────────────────────────────\n  // Registra todos los listeners después de cada render().\n  bindEvents() {\n    // TODO: agregar eventos DOM\n    // Ejemplo: this.container.querySelector('#miBoton')?.addEventListener('click', () => { ... });\n  }\n}\n"
);

// ── src/assets/report.css ─────────────────────────────────────────────────────
fs.writeFileSync(path.join(assetsDir, 'report.css'),
  '/* Estilos específicos del reporte */\n'
);

console.log(`\n✓ Reporte "${name}" creado en packages/${name}/\n`);
console.log('  Estructura generada:');
console.log('    src/report.query.js   ← CAPA DE DATOS: GraphQL + transformación');
console.log('    src/report.calc.js    ← CAPA DE NEGOCIO: scoring y constantes');
console.log('    src/report.render.js  ← CAPA DE PRESENTACIÓN: funciones HTML');
console.log('    src/report.js         ← ORQUESTADOR: estado + ciclo de vida');
console.log('');
console.log('  Para empezar:');
console.log('    make dev REPORT=' + name);
