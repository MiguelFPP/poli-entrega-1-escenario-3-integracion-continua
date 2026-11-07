COMPOSE := docker compose
TEST_DB_URL := postgresql://pos:pos@db:5432/pos_test
FILE ?=

.DEFAULT_GOAL := help
.PHONY: help up down logs ps build migrate seed migrate-deploy api-test api-e2e web-test lint-api lint-web typecheck-api typecheck-web db-shell psql

help: ## Muestra los comandos disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

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
	$(COMPOSE) run --rm api pnpm migrate

migrate-deploy: ## Aplica migraciones sin prompts (CI/producción)
	$(COMPOSE) run --rm api pnpm migrate:deploy

seed: ## Ejecuta el seed de la base pos
	$(COMPOSE) run --rm api pnpm seed

api-test: ## Pruebas unitarias de la API (FILE=archivo opcional)
	$(COMPOSE) run --rm api pnpm test -- $(FILE)

api-e2e: ## Pruebas e2e de la API contra pos_test (FILE=archivo opcional)
	$(COMPOSE) run --rm -e DATABASE_URL=$(TEST_DB_URL) api pnpm test:e2e -- $(FILE)

web-test: ## Pruebas de la web (FILE=archivo opcional)
	$(COMPOSE) run --rm web pnpm test -- $(FILE)

lint-api: ## ESLint de la API
	$(COMPOSE) run --rm api pnpm lint

lint-web: ## ESLint de la web
	$(COMPOSE) run --rm web pnpm lint

typecheck-api: ## TypeScript de la API
	$(COMPOSE) run --rm api pnpm typecheck

typecheck-web: ## TypeScript de la web
	$(COMPOSE) run --rm web pnpm typecheck

db-shell: ## Shell dentro del contenedor de PostgreSQL
	$(COMPOSE) exec db sh

psql: ## Cliente psql interactivo sobre la base pos
	$(COMPOSE) exec db psql -U $${POSTGRES_USER:-pos} -d $${POSTGRES_DB:-pos}
