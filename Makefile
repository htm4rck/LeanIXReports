# LeanIX Reports - Makefile
# Usage: make <target> [REPORT=<report-name>]

REPORTS = capability-tags capability-poster
REPORT ?=
ENV_FILE = c:\enviroment\leanix.json

# ─── Install ───────────────────────────────────────────────────────────────────

.PHONY: install
install: ## Install all dependencies (root + all packages)
	npm install

.PHONY: install-report
install-report: ## Install a specific report: make install-report REPORT=capability-tags
	@if "$(REPORT)"=="" (echo ERROR: specify REPORT=name && exit /b 1)
	cd packages\$(REPORT) && npm install

# ─── Development ───────────────────────────────────────────────────────────────

.PHONY: dev
dev: ## Start dev server for a report: make dev REPORT=capability-tags
	@if "$(REPORT)"=="" (echo ERROR: specify REPORT=name && exit /b 1)
	copy /Y "$(ENV_FILE)" packages\$(REPORT)\lxr.json
	@if not exist packages\$(REPORT)\node_modules mklink /J packages\$(REPORT)\node_modules node_modules
	cd packages\$(REPORT) && npm start

.PHONY: dev-tags
dev-tags: ## Start dev server for capability-tags
	copy /Y "$(ENV_FILE)" packages\capability-tags\lxr.json
	@if not exist packages\capability-tags\node_modules mklink /J packages\capability-tags\node_modules node_modules
	cd packages\capability-tags && npm start

.PHONY: dev-poster
dev-poster: ## Start dev server for capability-poster
	copy /Y "$(ENV_FILE)" packages\capability-poster\lxr.json
	@if not exist packages\capability-poster\node_modules mklink /J packages\capability-poster\node_modules node_modules
	cd packages\capability-poster && npm start

# ─── Build ─────────────────────────────────────────────────────────────────────

.PHONY: build
build: ## Build a specific report: make build REPORT=capability-tags
	@if "$(REPORT)"=="" (echo ERROR: specify REPORT=name && exit /b 1)
	cd packages\$(REPORT) && npm run build

.PHONY: build-all
build-all: ## Build all reports
	@for %%r in ($(REPORTS)) do (echo Building %%r... && cd packages\%%r && npm run build && cd ..\.. )

# ─── Upload ────────────────────────────────────────────────────────────────────

.PHONY: upload
upload: ## Upload a specific report: make upload REPORT=capability-tags
	@if "$(REPORT)"=="" (echo ERROR: specify REPORT=name && exit /b 1)
	copy /Y "$(ENV_FILE)" packages\$(REPORT)\lxr.json
	cd packages\$(REPORT) && npm run upload

.PHONY: upload-all
upload-all: ## Upload all reports
	@for %%r in ($(REPORTS)) do (echo Uploading %%r... && cd packages\%%r && npm run upload && cd ..\.. )

.PHONY: upload-tags
upload-tags: ## Upload capability-tags report
	copy /Y "$(ENV_FILE)" packages\capability-tags\lxr.json
	cd packages\capability-tags && npm run upload

.PHONY: upload-poster
upload-poster: ## Upload capability-poster report
	copy /Y "$(ENV_FILE)" packages\capability-poster\lxr.json
	cd packages\capability-poster && npm run upload

# ─── Utilities ─────────────────────────────────────────────────────────────────

.PHONY: new
new: ## Create a new report: make new REPORT=my-report
	@if "$(REPORT)"=="" (echo ERROR: specify REPORT=name && exit /b 1)
	node scripts\new-report.js $(REPORT)

.PHONY: clean
clean: ## Remove dist folders from all reports
	@for %%r in ($(REPORTS)) do (if exist packages\%%r\dist rmdir /s /q packages\%%r\dist)

.PHONY: bump
bump: ## Bump patch version of a report: make bump REPORT=capability-tags
	@if "$(REPORT)"=="" (echo ERROR: specify REPORT=name && exit /b 1)
	cd packages\$(REPORT) && npm version patch --no-git-tag-version

.PHONY: list
list: ## List all available reports
	@echo Available reports:
	@for %%r in ($(REPORTS)) do @echo   - %%r

.PHONY: help
help: ## Show this help
	@echo.
	@echo LeanIX Reports - Available commands:
	@echo.
	@echo   make install              Install all dependencies
	@echo   make install-report       Install specific report (REPORT=name)
	@echo.
	@echo   make dev REPORT=name      Start dev server for a report
	@echo   make dev-tags             Start dev for capability-tags
	@echo   make dev-poster           Start dev for capability-poster
	@echo.
	@echo   make build REPORT=name    Build a specific report
	@echo   make build-all            Build all reports
	@echo.
	@echo   make upload REPORT=name   Upload a specific report
	@echo   make upload-all           Upload all reports
	@echo   make upload-tags          Upload capability-tags
	@echo   make upload-poster        Upload capability-poster
	@echo.
	@echo   make new REPORT=name      Scaffold a new report
	@echo   make bump REPORT=name     Bump patch version
	@echo   make clean                Remove all dist folders
	@echo   make list                 List available reports
	@echo.
