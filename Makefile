SHELL := /bin/bash

# LeanIX Reports — Makefile
# Uso: make <target> REPORT=<nombre>
# Ejemplo: make dev REPORT=software-quadrant

ENV_FILE ?= .leanix.local.json
PKG_DIR  := packages
REPORT   ?=
REPORT_DIR := $(PKG_DIR)/$(REPORT)
REPORTS := $(filter-out $(PKG_DIR)/shared,$(sort $(wildcard $(PKG_DIR)/*)))

.PHONY: install dev dev-remote tunnel-help build build-all upload upload-all new clean bump list help prepare-report ensure-report ensure-report-name ensure-env

install:
	npm install

ensure-report-name:
	@test -n "$(REPORT)" || (echo && echo "ERROR: debes indicar el reporte. Ejemplo: make dev REPORT=software-quadrant" && echo && exit 1)

ensure-report:
	@$(MAKE) ensure-report-name REPORT="$(REPORT)"
	@test -d "$(REPORT_DIR)" || (echo && echo "ERROR: no existe $(REPORT_DIR)" && echo && exit 1)

ensure-env:
	@test -f "$(ENV_FILE)" || (echo && echo "ERROR: falta $(ENV_FILE). Completa host y apitoken en el archivo de la raíz." && echo && exit 1)

prepare-report: ensure-report ensure-env
	@cp "$(ENV_FILE)" "$(REPORT_DIR)/lxr.json"
	@if [ ! -e "$(REPORT_DIR)/node_modules" ]; then ln -s ../../node_modules "$(REPORT_DIR)/node_modules"; fi

dev: prepare-report
	cd "$(REPORT_DIR)" && npm start

dev-remote: prepare-report
	@echo
	@echo "Levanta el servidor remoto y luego abre un tunel SSH desde tu maquina local:"
	@echo "  ssh -L 8080:127.0.0.1:8080 <usuario>@<servidor>"
	@echo
	@echo "Cuando el tunel este activo, abre en tu navegador local:"
	@echo "  https://localhost:8080"
	@echo
	cd "$(REPORT_DIR)" && npm start

tunnel-help:
	@echo
	@echo "Uso remoto recomendado:"
	@echo "  1. En el servidor: make dev-remote REPORT=software-landscape"
	@echo "  2. En tu maquina: ssh -L 8080:127.0.0.1:8080 <usuario>@<servidor>"
	@echo "  3. Abrir: https://localhost:8080"
	@echo

build: ensure-report
	cd "$(REPORT_DIR)" && npm run build

build-all:
	@for report in $(REPORTS); do \
		echo "Building $$(basename "$$report")..."; \
		(cd "$$report" && npm run build) || exit $$?; \
	done

upload: prepare-report
	cd "$(REPORT_DIR)" && npm run upload

upload-all: ensure-env
	@for report in $(REPORTS); do \
		echo "Uploading $$(basename "$$report")..."; \
		cp "$(ENV_FILE)" "$$report/lxr.json"; \
		if [ ! -e "$$report/node_modules" ]; then ln -s ../../node_modules "$$report/node_modules"; fi; \
		(cd "$$report" && npm run upload) || exit $$?; \
	done

new: ensure-report-name
	node scripts/new-report.js "$(REPORT)"

clean:
	@for report in $(REPORTS); do \
		if [ -d "$$report/dist" ]; then \
			echo "Limpiando $$(basename "$$report")..."; \
			rm -rf "$$report/dist"; \
		fi; \
	done

bump: ensure-report
	cd "$(REPORT_DIR)" && npm version patch --no-git-tag-version

list:
	@echo
	@echo "Reportes disponibles:"
	@for report in $(REPORTS); do echo "  - $$(basename "$$report")"; done
	@echo

help:
	@echo
	@echo "LeanIX Reports — Comandos disponibles:"
	@echo
	@echo "  make install                        Instala dependencias"
	@echo "  make dev    REPORT=nombre           Levanta dev server"
	@echo "  make dev-remote REPORT=nombre       Levanta dev server para uso remoto por SSH tunnel"
	@echo "  make build  REPORT=nombre           Build de un reporte"
	@echo "  make build-all                      Build de todos los reportes"
	@echo "  make upload REPORT=nombre           Sube un reporte a LeanIX"
	@echo "  make upload-all                     Sube todos los reportes"
	@echo "  make new    REPORT=nombre           Scaffold de nuevo reporte"
	@echo "  make bump   REPORT=nombre           Bump version patch"
	@echo "  make clean                          Elimina carpetas dist"
	@echo "  make list                           Lista reportes disponibles"
	@echo "  make tunnel-help                    Recordatorio del flujo remoto con SSH tunnel"
	@echo "  ENV_FILE=.leanix.local.json         Archivo local de credenciales"
	@echo
