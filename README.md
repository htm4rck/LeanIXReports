# LeanIX Custom Reports

Batería de reportes personalizados para LeanIX — Alicorp.

## Arquitectura

```
leanix-reports/
├── config/
│   └── webpack.base.js      ← Config webpack compartida (única fuente de verdad)
├── packages/
│   ├── shared/              ← Código compartido (utils, estilos, helpers)
│   ├── capability-tags/     ← Business Capability Map with Tags
│   ├── capability-poster/   ← Capability Poster
│   ├── strategic-map/       ← Mapa Estratégico Relacional
│   ├── technical-fit/       ← Technical Fit — Evaluación automática
│   ├── software-quadrant/   ← Software Health Quadrant (Agilidad vs Resiliencia)
│   └── [nuevo-reporte]/     ← Agregar nuevos reportes aquí
├── scripts/
│   ├── new-report.js        ← Scaffold de nuevos reportes
│   └── upload.js            ← Script de upload
├── Makefile                 ← Automatización (auto-detecta reportes)
├── package.json             ← Dependencias hoisted (incluyendo webpack devDeps)
└── README.md
```

### Principios de la arquitectura

**Monorepo con dependencias hoisted**: todas las `node_modules` viven en la raíz. Cada reporte en `packages/` es independiente pero comparte las dependencias. El Makefile crea un symlink (`mklink /J`) de `node_modules` en cada reporte para que el CLI de LeanIX las encuentre.

**Config webpack centralizada** (`config/webpack.base.js`): todos los reportes extienden esta config con una sola línea. Si cambia un loader, alias o el devServer, se modifica en un solo lugar.

```js
// webpack.config.js de cualquier reporte
var createWebpackConfig = require('../../config/webpack.base');
module.exports = createWebpackConfig(__dirname);
```

**Shared package** (`packages/shared/`): utilidades reutilizables importadas con `@shared/`:
- `BaseReport` — Clase base con loading, error y empty states
- `escapeHtml(str)` — Escape XSS
- `getShortName(displayName)` — Extrae nombre corto de path LeanIX
- `getTagColor(tagName)` — Colores por tag
- `renderTags(tags)` — Renderiza chips de tags
- `graphQL(query)` — Wrapper para `lx.executeGraphQL`
- `styles/base.css` — Estilos base compartidos

**Makefile auto-detecta reportes**: no hay targets hardcodeados por reporte. Al agregar un nuevo reporte en `packages/`, automáticamente queda disponible en `make dev`, `make build`, `make upload`, etc.

**devDependencies hoisted**: las dependencias de webpack (`babel-loader`, `css-loader`, etc.) están declaradas solo en el `package.json` raíz. Los `package.json` de cada reporte solo declaran sus dependencias de runtime específicas.

---

## Credenciales

Crear o completar `./.leanix.local.json` en la raíz:

```json
{
  "host": "tu-instancia.leanix.net",
  "apitoken": "tu-api-token-aqui"
}
```

El `Makefile` lo copia automáticamente a `packages/<reporte>/lxr.json` antes de cada `dev` o `upload`. Nunca se commitea.

---

## Comandos

### Con Make (recomendado)

| Comando | Descripción |
|---------|-------------|
| `make install` | Instala todas las dependencias |
| `make dev REPORT=software-quadrant` | Levanta dev server |
| `make dev-remote REPORT=software-quadrant` | Levanta dev server para uso remoto con túnel SSH |
| `make build REPORT=software-quadrant` | Build de un reporte |
| `make build-all` | Build de todos los reportes |
| `make upload REPORT=software-quadrant` | Sube un reporte a LeanIX |
| `make upload-all` | Sube todos los reportes |
| `make new REPORT=mi-reporte` | Scaffold de nuevo reporte |
| `make bump REPORT=software-quadrant` | Bump de versión patch |
| `make clean` | Elimina carpetas dist |
| `make list` | Lista reportes disponibles (auto-detectados) |

### Sin Make (pasos manuales)

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar credenciales
cp .leanix.local.json packages/software-quadrant/lxr.json

# 3. Crear symlink de node_modules (si no existe)
ln -s ../../node_modules packages/software-quadrant/node_modules

# 4. Levantar dev server
cd packages/software-quadrant
npm start
```

### Desarrollo remoto

Si el reporte corre en un servidor y el navegador lo abres desde tu máquina local, `lxr` imprimirá una URL con `https://localhost:8080`. En ese caso debes tunelizar ese puerto a tu máquina:

```bash
# En el servidor
make dev-remote REPORT=software-landscape

# En tu máquina local
ssh -L 8080:127.0.0.1:8080 <usuario>@<servidor>
```

Luego abre en tu navegador local:

```bash
https://localhost:8080
```

---

## Crear un nuevo reporte

```bash
make new REPORT=mi-reporte
make dev REPORT=mi-reporte
```

El scaffold genera automáticamente:
- `package.json` limpio (sin devDeps duplicadas)
- `webpack.config.js` que extiende `config/webpack.base.js`
- `src/index.html`, `src/index.js`, `src/report.js` con estructura base
- `src/assets/report.css`

---

## Reportes disponibles

| Reporte | Descripción |
|---------|-------------|
| `capability-tags` | Business Capability Map con filtros por tag |
| `capability-poster` | Poster horizontal de capacidades críticas |
| `strategic-map` | Mapa estratégico relacional multi-capa |
| `technical-fit` | Evaluación automática de Technical Fit del portafolio |
| `software-quadrant` | Cuadrante de salud de software (Agilidad vs Resiliencia) |
