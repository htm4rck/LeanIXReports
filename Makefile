# LeanIX Reports — Makefile
# Uso: make <target> REPORT=<nombre>
# Ejemplo: make dev REPORT=software-quadrant

ENV_FILE = c:\enviroment\leanix.json
PKG_DIR  = packages
REPORT   =

# ─── Install ───────────────────────────────────────────────────────────────────

.PHONY: install
install:
	npm install

# ─── Development ───────────────────────────────────────────────────────────────

.PHONY: dev
dev:
	@if "$(REPORT)"=="" (echo. && echo ERROR: debes indicar el reporte. Ejemplo: make dev REPORT=software-quadrant && echo. && exit /b 1)
	copy /Y "$(ENV_FILE)" $(PKG_DIR)\$(REPORT)\lxr.json
	@if not exist $(PKG_DIR)\$(REPORT)\node_modules mklink /J $(PKG_DIR)\$(REPORT)\node_modules node_modules
	cd $(PKG_DIR)\$(REPORT) && npm start

# ─── Build ─────────────────────────────────────────────────────────────────────

.PHONY: build
build:
	@if "$(REPORT)"=="" (echo. && echo ERROR: debes indicar el reporte. Ejemplo: make build REPORT=software-quadrant && echo. && exit /b 1)
	cd $(PKG_DIR)\$(REPORT) && npm run build

.PHONY: build-all
build-all:
	@for /D %%r in ($(PKG_DIR)\*) do @if not "%%~nxr"=="shared" (echo Building %%~nxr... && cd %%r && npm run build && cd ..\.. )

# ─── Upload ────────────────────────────────────────────────────────────────────

.PHONY: upload
upload:
	@if "$(REPORT)"=="" (echo. && echo ERROR: debes indicar el reporte. Ejemplo: make upload REPORT=software-quadrant && echo. && exit /b 1)
	copy /Y "$(ENV_FILE)" $(PKG_DIR)\$(REPORT)\lxr.json
	@if not exist $(PKG_DIR)\$(REPORT)\node_modules mklink /J $(PKG_DIR)\$(REPORT)\node_modules node_modules
	cd $(PKG_DIR)\$(REPORT) && npm run upload

.PHONY: upload-all
upload-all:
	@for /D %%r in ($(PKG_DIR)\*) do @if not "%%~nxr"=="shared" (copy /Y "$(ENV_FILE)" %%r\lxr.json && cd %%r && npm run upload && cd ..\..)

# ─── Utilities ─────────────────────────────────────────────────────────────────

.PHONY: new
new:
	@if "$(REPORT)"=="" (echo. && echo ERROR: debes indicar el reporte. Ejemplo: make new REPORT=mi-reporte && echo. && exit /b 1)
	node scripts\new-report.js $(REPORT)

.PHONY: clean
clean:
	@for /D %%r in ($(PKG_DIR)\*) do @if exist %%r\dist (echo Limpiando %%~nxr... && rmdir /s /q %%r\dist)

.PHONY: bump
bump:
	@if "$(REPORT)"=="" (echo. && echo ERROR: debes indicar el reporte. Ejemplo: make bump REPORT=software-quadrant && echo. && exit /b 1)
	cd $(PKG_DIR)\$(REPORT) && npm version patch --no-git-tag-version

.PHONY: list
list:
	@echo.
	@echo Reportes disponibles:
	@for /D %%r in ($(PKG_DIR)\*) do @if not "%%~nxr"=="shared" echo   - %%~nxr
	@echo.

.PHONY: help
help:
	@echo.
	@echo LeanIX Reports — Comandos disponibles:
	@echo.
	@echo   make install                        Instala dependencias
	@echo   make dev    REPORT=nombre           Levanta dev server
	@echo   make build  REPORT=nombre           Build de un reporte
	@echo   make build-all                      Build de todos los reportes
	@echo   make upload REPORT=nombre           Sube un reporte a LeanIX
	@echo   make upload-all                     Sube todos los reportes
	@echo   make new    REPORT=nombre           Scaffold de nuevo reporte
	@echo   make bump   REPORT=nombre           Bump version patch
	@echo   make clean                          Elimina carpetas dist
	@echo   make list                           Lista reportes disponibles
	@echo.
