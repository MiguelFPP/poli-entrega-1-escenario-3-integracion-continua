# syntax=docker/dockerfile:1

# ---- base: Node 26 + pnpm ----
FROM node:26-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN npm install --global pnpm@12.16.1 \
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
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["pnpm", "dev"]

# ---- build: compilación de producción ----
FROM deps AS build
COPY . .
RUN pnpm --filter @pos/web build

# ---- prod: salida standalone de Next ----
FROM node:26-bookworm-slim AS prod
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
