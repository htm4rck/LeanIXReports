const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) {
  console.error('Uso: node scripts/new-report.js <nombre-del-reporte>');
  process.exit(1);
}

const dir = path.resolve(__dirname, '..', 'packages', name);
const srcDir = path.join(dir, 'src');
const assetsDir = path.join(srcDir, 'assets');

fs.mkdirSync(assetsDir, { recursive: true });

fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
  name: `@leanix-reports/${name}`,
  version: '1.0.0',
  description: `LeanIX Report: ${name}`,
  private: true,
  leanixReport: { id: `pe.com.alicorp.${name.replace(/-/g, '')}`, title: name, defaultConfig: {} },
  leanixReportingCli: { distPath: 'dist', buildCommand: 'npx webpack' },
  scripts: { build: 'lxr build', start: 'lxr start', upload: 'lxr upload' },
  devDependencies: {
    '@babel/core': '^7.25.8', '@babel/preset-env': '^7.25.8',
    'babel-loader': '^9.2.1', 'copy-webpack-plugin': '^6.3.1',
    'css-loader': '^7.1.2', 'file-loader': '^6.2.0',
    'html-webpack-plugin': '^5.6.2', 'style-loader': '^4.0.0',
    'url-loader': '^4.1.1', 'webpack': '^5.0.0',
    'webpack-cli': '^5.1.4', 'webpack-dev-server': '^5.2.1'
  },
  dependencies: {
    '@leanix/reporting': '^0.4.148',
    '@leanix-reports/shared': '*',
    'lodash': '^4.17.21'
  }
}, null, 2));

fs.copyFileSync(
  path.resolve(__dirname, '..', 'packages', 'capability-tags', 'webpack.config.js'),
  path.join(dir, 'webpack.config.js')
);

fs.writeFileSync(path.join(srcDir, 'index.html'), `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name}</title>
  </head>
  <body><div id="report"></div></body>
</html>`);

fs.writeFileSync(path.join(srcDir, 'index.js'), `import '@leanix/reporting';
import '@shared/styles/base.css';
import './assets/report.css';
import { Report } from './report.js';

lx.init().then(setup => {
  new Report(setup).loadData();
});`);

fs.writeFileSync(path.join(srcDir, 'report.js'), `import { BaseReport, escapeHtml, graphQL } from '@shared/index.js';

export class Report extends BaseReport {
  constructor(setup) {
    super(setup);
  }

  async loadData() {
    this.showLoading();
    try {
      // TODO: tu query GraphQL aquí
      const result = await graphQL(\`{ allFactSheets(first: 5) { edges { node { id displayName } } } }\`);
      this.render(result);
    } catch (error) {
      this.showError(error);
    }
  }

  render(data) {
    this.container.innerHTML = '<p>TODO: implementar render</p>';
  }
}`);

fs.writeFileSync(path.join(assetsDir, 'report.css'), '/* Estilos específicos del reporte */\n');

console.log(`✓ Reporte "${name}" creado en packages/${name}/`);
console.log('  1. Crea lxr.json con tu API token');
console.log('  2. Ejecuta npm install desde la raíz');
console.log(`  3. cd packages/${name} && npm start`);
