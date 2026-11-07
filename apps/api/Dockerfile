# syntax=docker/dockerfile:1

# ---- base: Node 26 + pnpm ----
FROM node:26-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN apt-get update \
  && apt-get install --no-install-recommends --yes openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global pnpm@12.16.1 \
  && pnpm --version
WORKDIR /app

# ---- deps: dependencias del monorepo ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --no-frozen-lockfile

# ---- dev: desarrollo con recarga en caliente ----
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
RUN pnpm --filter @pos/api prisma generate
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["pnpm", "start:dev"]

# ---- build: compilación de producción ----
FROM deps AS build
COPY . .
RUN pnpm --filter @pos/api prisma generate \
  && pnpm --filter @pos/api build

# ---- prod: imagen final ----
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
