COMPOSE := docker compose
TEST_DB_URL := postgresql://pos:pos@db:5432/pos_test
FILE ?=

.DEFAULT_GOAL := help
.PHONY: help up down logs ps build migrate migrate-test migrate-deploy seed seed-demo api-test api-e2e web-test lint-api lint-web typecheck-api typecheck-web lint typecheck api-test-cov api-e2e-cov web-test-cov test-all test-reset reset smoke db-shell psql

help: ## Muestra los comandos disponibles
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Construye y levanta db, api y web
	$(COMPOSE) up -d --build

down: ## Detiene y elimina los contenedores (conserva el volumen)
	$(COMPOSE) down

logs: ## Sigue los logs de todos los servicios
	$(COMPOSE) logs -f --tail=100

ps: ## Estado de los servicios
	$(COMPOSE) ps

build: ## Reconstruye las imágenes de api y web
	$(COMPOSE) build

migrate: ## Aplica migraciones de Prisma en la base pos
	$(COMPOSE) run --rm -v "$(CURDIR)/apps/api/prisma:/app/apps/api/prisma" api pnpm migrate

migrate-deploy: ## Aplica migraciones sin prompts (CI/producción)
	$(COMPOSE) run --rm api pnpm migrate:deploy

migrate-test: ## Aplica migraciones sobre pos_test (previo a los e2e)
	$(COMPOSE) run --rm -v "$(CURDIR)/apps/api/prisma:/app/apps/api/prisma" -e DATABASE_URL=$(TEST_DB_URL) api pnpm migrate:test

seed: ## Ejecuta el seed base de la base pos
	$(COMPOSE) run --rm api pnpm seed

seed-demo: ## Genera datos de demo en la base pos (borra datos previos)
	$(COMPOSE) run --rm api pnpm seed:demo

api-test: ## Pruebas unitarias de la API (FILE=archivo opcional)
	$(COMPOSE) run --rm api pnpm test $(FILE)

api-e2e: migrate-test ## Pruebas e2e de la API contra pos_test (FILE=archivo opcional)
	$(COMPOSE) run --rm -e DATABASE_URL=$(TEST_DB_URL) api pnpm test:e2e $(FILE)

web-test: ## Pruebas de la web (FILE=archivo opcional)
	$(COMPOSE) run --rm web pnpm test $(FILE)

api-test-cov: ## Cobertura de las pruebas unitarias de la API
	$(COMPOSE) run --rm api pnpm test:cov

api-e2e-cov: migrate-test ## Cobertura e2e de la API contra pos_test (migra antes)
	$(COMPOSE) run --rm -e DATABASE_URL=$(TEST_DB_URL) api pnpm test:e2e:cov

web-test-cov: ## Cobertura de las pruebas de la web
	$(COMPOSE) run --rm web pnpm test:cov

test-all: api-test-cov api-e2e-cov web-test-cov ## Cobertura completa: API (unit + e2e) y web

lint-api: ## ESLint de la API
	$(COMPOSE) run --rm api pnpm lint

lint-web: ## ESLint de la web
	$(COMPOSE) run --rm web pnpm lint

typecheck-api: ## TypeScript de la API
	$(COMPOSE) run --rm api pnpm typecheck

typecheck-web: ## TypeScript de la web
	$(COMPOSE) run --rm web pnpm typecheck

lint: lint-api lint-web ## ESLint de la API y la web

typecheck: typecheck-api typecheck-web ## TypeScript de la API y la web

db-shell: ## Shell dentro del contenedor de PostgreSQL
	$(COMPOSE) exec db sh

psql: ## Cliente psql interactivo sobre la base pos
	$(COMPOSE) exec db psql -U $${POSTGRES_USER:-pos} -d $${POSTGRES_DB:-pos}

test-reset: ## REINICIA el volumen (borra datos), reconstruye y levanta db, api y web
	$(COMPOSE) down -v
	$(COMPOSE) up -d --build

reset: ## Reinicia la base pos (migrate reset + seed)
	$(COMPOSE) run --rm api pnpm db:reset

smoke: ## Comprueba salud y sesión real de la API y la web
	./scripts/smoke.sh
