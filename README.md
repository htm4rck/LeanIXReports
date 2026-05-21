# LeanIX Custom Reports

Batería de reportes personalizados para LeanIX.

## Arquitectura

```
leanix-reports/
├── packages/
│   ├── shared/              ← Código compartido (utils, estilos, helpers)
│   ├── capability-tags/     ← Business Capability Map with Tags
│   ├── capability-poster/   ← Capability Poster
│   └── [nuevo-reporte]/     ← Agregar nuevos reportes aquí
├── scripts/
│   ├── new-report.js        ← Script para scaffolding de nuevos reportes
│   └── upload.js            ← Script de upload
├── Makefile                 ← Automatización de tareas
├── package.json             ← Dependencias compartidas (hoisted)
└── README.md
```

**Monorepo con dependencias hoisted**: todas las `node_modules` viven en la raíz. Cada reporte en `packages/` es un proyecto independiente con su propio `package.json` pero comparte las dependencias instaladas en la raíz. El Makefile crea un symlink (`mklink /J`) de `node_modules` en cada reporte para que el CLI de LeanIX las encuentre.

**Shared package** (`packages/shared/`): contiene utilidades reutilizables que se importan con `@shared/` desde cualquier reporte:
- `BaseReport` — Clase base con loading, error y empty states
- `escapeHtml(str)` — Escape XSS
- `getShortName(displayName)` — Extrae nombre corto de path LeanIX
- `getTagColor(tagName)` — Colores por tag
- `renderTags(tags)` — Renderiza chips de tags
- `graphQL(query)` — Wrapper para `lx.executeGraphQL`
- `styles/base.css` — Estilos base compartidos

**Configuración de credenciales**: debes crear manualmente el archivo `c:\enviroment\leanix.json` con tu API token de LeanIX en el siguiente formato:

```json
{
  "host": "tu-instancia.leanix.net",
  "apitoken": "tu-api-token-aqui"
}
```

Este archivo se copia automáticamente al reporte antes de ejecutar. Nunca se commitea.

---

## Sin Make (pasos manuales)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar credenciales

Copiar tu archivo de credenciales al reporte que vas a trabajar:

```bash
copy c:\enviroment\leanix.json packages\capability-tags\lxr.json
```

### 3. Crear symlink de node_modules (si no existe)

```bash
mklink /J packages\capability-tags\node_modules node_modules
```

### 4. Levantar dev server

```bash
cd packages\capability-tags
npm start
```

### 5. Subir reporte

```bash
cd packages\capability-tags
npm run upload
```

### 6. Crear nuevo reporte

```bash
node scripts\new-report.js mi-reporte
```

---

## Con Make

### Requisito

Tener `make` disponible (viene con Git Bash, Chocolatey: `choco install make`, o WSL).

### Comandos principales

| Comando | Descripción |
|---------|-------------|
| `make install` | Instala todas las dependencias |
| `make dev REPORT=capability-tags` | Levanta dev server (copia lxr.json + symlink automático) |
| `make dev-tags` | Atajo para capability-tags |
| `make dev-poster` | Atajo para capability-poster |
| `make build REPORT=capability-tags` | Build de un reporte |
| `make build-all` | Build de todos los reportes |
| `make upload REPORT=capability-tags` | Sube un reporte a LeanIX |
| `make upload-all` | Sube todos los reportes |
| `make new REPORT=mi-reporte` | Scaffold de nuevo reporte |
| `make bump REPORT=capability-tags` | Bump de versión patch |
| `make clean` | Elimina carpetas dist |
| `make list` | Lista reportes disponibles |
| `make help` | Muestra ayuda |

### Flujo típico con Make

```bash
# Primera vez
make install

# Desarrollar
make dev REPORT=capability-tags

# Subir a producción
make upload REPORT=capability-tags
```

El Makefile automatiza: copiar `lxr.json` desde la ruta centralizada, crear el symlink de `node_modules`, y ejecutar el comando correspondiente.
