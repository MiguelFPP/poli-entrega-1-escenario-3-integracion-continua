# POS — Sistema de punto de venta

Monorepo del sistema POS. **Estado actual: Fase 2 (autenticación y usuarios)**.
La Fase 0 dejó la infraestructura (contenedores de web, API y base de datos,
endpoint de salud y Swagger) y la Fase 1 el modelo de datos completo de Prisma,
las migraciones, las _factories_ con Faker y los seeds base y demo.

La Fase 2 agrega autenticación con JWT de acceso + refresh token rotativo en
cookies `httpOnly`, guards globales (auth, roles, `Origin` y rate limit) y el
CRUD de usuarios restringido a `ADMIN`, todo documentado en Swagger. La pantalla
de login llega en la Fase 7.

## Stack

| Componente   | Versión                                                   |
| ------------ | --------------------------------------------------------- |
| Node.js      | 26 (`node:26-bookworm-slim`)                              |
| pnpm         | 12.16.1                                                   |
| NestJS       | 12.4.0 (ESM)                                              |
| Next.js      | 16.4.5 + React 19.3.1                                     |
| Prisma       | 7.10.1 + `@prisma/adapter-pg`                             |
| Faker        | 10.6.0 (`@faker-js/faker`, factories y seeds)             |
| tsx          | 4.23.15 (ejecuta los seeds en TypeScript)                 |
| bcryptjs     | 3.0.3 (hash del usuario administrador)                    |
| PostgreSQL   | 17 (alpine)                                               |
| TypeScript   | 5.9.3                                                     |
| Tailwind CSS | 4.3.5                                                     |
| Tests        | Jest 30 + ts-jest (API), Vitest 5 + Testing Library (web) |

## Requisitos

- Docker Engine 29+ con Docker Compose v2/v5.
- `make` (opcional, pero recomendado: encapsula todos los comandos).

No se necesita Node.js ni pnpm en el host: todo se ejecuta dentro de contenedores.

## Estructura

```
.
├── apps/
│   ├── api/            # NestJS 12 (ESM) + Prisma 7 + Swagger
│   │   ├── prisma/     # schema, migraciones, factories y seeds
│   │   │   ├── migrations/  # SQL versionado (init + sale_number_seq)
│   │   │   ├── factories/   # builders puros + create* con Prisma
│   │   │   ├── seed.ts      # seed base idempotente
│   │   │   └── seed-demo.ts # datos de demostración
│   │   ├── src/
│   │   │   ├── app.setup.ts  # prefijo, pipes, helmet, CORS y cookies (main + e2e)
│   │   │   ├── common/       # decoradores, guards globales, rate limit y helpers
│   │   │   ├── config/       # validación de env y orígenes permitidos
│   │   │   ├── health/       # GET /api/v1/health (público)
│   │   │   ├── modules/
│   │   │   │   ├── auth/     # login, refresh, logout, me y tokens
│   │   │   │   └── users/    # CRUD de usuarios (solo ADMIN)
│   │   │   └── prisma/       # PrismaService con adaptador pg
│   │   └── test/       # unitarios y e2e con Supertest
│   └── web/            # Next.js 16 (App Router) + Tailwind 4
│       └── src/
│           ├── app/        # layout, page y tokens M3 (globals.css)
│           ├── components/ # AppShell (top app bar + navegación)
│           └── lib/        # apiFetch
├── infra/postgres/     # init.sql (crea pos_test)
├── docker-compose.yml  # db + api + web en la red pos-net
└── Makefile
```

## Puesta en marcha

```bash
cp .env.example .env      # opcional: docker-compose tiene valores por defecto
make up                   # docker compose up -d --build
make ps                   # estado de los servicios
make logs                 # logs en vivo
```

Servicios resultantes:

| Servicio   | URL                                                     |
| ---------- | ------------------------------------------------------- |
| Web        | http://localhost:3000                                   |
| API        | http://localhost:3001/api/v1                            |
| Swagger    | http://localhost:3001/api/docs                          |
| PostgreSQL | `localhost:5432` (base `pos`, base de tests `pos_test`) |

No se usan bind mounts: el código vive dentro de las imágenes. Después de cambiar
código hay que reconstruir (`make build` o `docker compose up -d --build`).

## Arquitectura

```mermaid
flowchart LR
  browser[Navegador] -->|:3000| web[Next.js 16]
  web -->|rewrite /api/v1/*| api[NestJS 12 :3001]
  api -->|Prisma + pg| db[(PostgreSQL 17)]
```

- **web**: shell mínimo Material You (top app bar, navegación lateral, superficies
  tonales). El rewrite de `next.config.ts` envía `/api/v1/:path*` a
  `API_INTERNAL_URL` (por defecto `http://api:3001`), por lo que el navegador
  siempre habla con un único origen.
- **api**: prefijo global `/api/v1`, `ValidationPipe` global, `helmet`,
  `cookie-parser`, CORS con credenciales, guards globales (auth, roles, `Origin`,
  rate limit) y Swagger en `/api/docs`.
- **db**: volumen `pgdata`; `infra/postgres/init.sql` crea la base `pos_test` que
  consumen las pruebas e2e.

## Endpoint de salud

`GET /api/v1/health` no requiere autenticación. Responde **200** cuando la base de
datos responde y **503** cuando no.

```json
{
  "status": "ok",
  "database": "up",
  "timestamp": "2026-01-15T12:34:56.789Z"
}
```

Cuando PostgreSQL no responde:

```json
{
  "status": "error",
  "database": "down",
  "timestamp": "2026-01-15T12:34:56.789Z"
}
```

El contenedor `api` usa este endpoint como healthcheck; `web` arranca solo cuando
la API está saludable. Está marcado con `@Public()`: es la única ruta, junto a
`login` y `refresh`, que no exige sesión.

## Autenticación y seguridad (Fase 2)

### Endpoints

| Método | Ruta                           | Acceso  | Descripción                                                          |
| ------ | ------------------------------ | ------- | -------------------------------------------------------------------- |
| POST   | `/api/v1/auth/login`           | Público | Valida credenciales y emite las cookies de sesión (5 req/min por IP) |
| POST   | `/api/v1/auth/refresh`         | Cookie  | Rota el refresh token y emite cookies nuevas                         |
| POST   | `/api/v1/auth/logout`          | Sesión  | Revoca el refresh actual y limpia las cookies                        |
| GET    | `/api/v1/auth/me`              | Sesión  | Usuario autenticado sin `passwordHash`                               |
| GET    | `/api/v1/users`                | ADMIN   | Listado paginado (`page`, `pageSize`, `search`, `active`)            |
| POST   | `/api/v1/users`                | ADMIN   | Crea un usuario `ADMIN`                                              |
| PATCH  | `/api/v1/users/:id`            | ADMIN   | Actualiza `name`, `email` y/o `active`                               |
| PATCH  | `/api/v1/users/:id/password`   | ADMIN   | Cambia la contraseña y revoca las sesiones del usuario               |
| PATCH  | `/api/v1/users/:id/deactivate` | ADMIN   | Desactiva la cuenta (no permite autodesactivarse)                    |
| GET    | `/api/v1/health`               | Público | Estado del servicio y de PostgreSQL                                  |

Un usuario autenticado sin rol `ADMIN` recibe `403` en `/users`; sin sesión,
`401`. No se borran usuarios: solo se desactivan (`active: false`).

### Cookies de sesión

| Cookie          | Contenido                                               | `Path`         | `Max-Age` | Atributos                                          |
| --------------- | ------------------------------------------------------- | -------------- | --------- | -------------------------------------------------- |
| `access_token`  | JWT HS256 (`sub`, `email`, `role`), expira a los 15 min | `/`            | 7 días    | `HttpOnly`, `SameSite=Lax`, `Secure` en producción |
| `refresh_token` | Token opaco de 64 bytes aleatorios                      | `/api/v1/auth` | 7 días    | `HttpOnly`, `SameSite=Lax`, `Secure` en producción |

- El **body de login/refresh nunca incluye tokens**: solo el usuario y los
  segundos de vigencia (`accessTokenExpiresIn` = 900, `refreshTokenExpiresIn` =
  604800). El frontend no puede leerlos desde JavaScript.
- En la base solo se guarda el **hash SHA-256** del refresh (con
  `JWT_REFRESH_SECRET` como _pepper_), junto a `userAgent`, `ip`, `expiresAt` y
  `revokedAt`.
- El access token caduca a los 15 minutos aunque la cookie dure 7 días: al
  recibir `401` hay que llamar a `/auth/refresh` y reintentar.

### Flujo de sesión

```mermaid
sequenceDiagram
  participant B as Navegador
  participant A as API
  B->>A: POST /auth/login {email, password}
  A-->>B: Set-Cookie access_token + refresh_token
  B->>A: GET /auth/me (cookies)
  A-->>B: 200 usuario
  Note over B,A: pasan 15 min (el access caduca)
  B->>A: POST /auth/refresh (cookie refresh_token)
  A-->>B: 200 + cookies nuevas (refresh rotado)
  B->>A: POST /auth/logout (cookies)
  A-->>B: 204 + cookies expiradas
```

**Rotación y detección de reuso.** Cada `refresh` revoca el token recibido y
crea uno nuevo. Si se presenta un refresh **ya revocado** se asume robo o
_replay_: se revocan **todas** las sesiones del usuario y se responde `401`.

### Ejemplos con curl

```bash
# 1. Login: guarda las cookies httpOnly en el cookie jar
curl -i -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@pos.local","password":"Admin123!"}' \
  http://localhost:3001/api/v1/auth/login

# 2. Perfil de la sesión (cookie o Bearer)
curl -b cookies.txt http://localhost:3001/api/v1/auth/me
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3001/api/v1/auth/me

# 3. Rotación del refresh (reemplaza las cookies)
curl -i -b cookies.txt -c cookies.txt -X POST \
  http://localhost:3001/api/v1/auth/refresh

# 4. Logout (revoca el refresh y expira las cookies)
curl -i -b cookies.txt -c cookies.txt -X POST \
  http://localhost:3001/api/v1/auth/logout

# 5. Usuarios (requiere rol ADMIN)
curl -b cookies.txt 'http://localhost:3001/api/v1/users?page=1&pageSize=20&search=admin'
curl -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Cajera Turno Mañana","email":"cajera@pos.local","password":"Cajera2026!"}' \
  http://localhost:3001/api/v1/users
curl -b cookies.txt -X PATCH http://localhost:3001/api/v1/users/<uuid>/deactivate
```

### Reglas de seguridad implementadas

- **Guards globales** (`APP_GUARD`), en este orden: rate limit → `Origin` →
  `JwtAuthGuard` → `RolesGuard`. Todo es privado salvo lo marcado con
  `@Public()`; los endpoints de `/users` declaran `@Roles(Role.ADMIN)`.
- **Access token**: se lee de la cookie `access_token` y, si no existe, de
  `Authorization: Bearer`. Firma HMAC-SHA256 sobre `node:crypto` con
  comparación en tiempo constante y validación de `exp` y `alg`.
- **Rate limit**: 600 peticiones por minuto por IP y ruta como límite global;
  `POST /auth/login` baja a **5 por minuto** (`@Throttle`) y responde `429` con
  `Retry-After` y `X-RateLimit-*`.
- **CSRF por `Origin`**: las mutaciones (`POST`, `PATCH`, `PUT`, `DELETE`) con
  cabecera `Origin` distinta de `WEB_ORIGIN` responden `403`. Sin `Origin`
  (curl, tests, server-to-server) la petición pasa. Ojo: Swagger UI se sirve en
  `http://localhost:3001`, así que para probar mutaciones desde ahí hay que
  añadir ese origen (`WEB_ORIGIN=http://localhost:3000,http://localhost:3001`).
- **CORS** con `credentials: true` y `origin: WEB_ORIGIN` (admite lista separada
  por comas) para que el proxy same-origin de Next.js pueda reenviar cookies.
- **Contraseñas**: bcrypt con coste 12; mínimo 8 caracteres con mayúscula,
  minúscula y número. Un email inexistente consume un hash señuelo para no
  filtrar qué cuentas existen.
- **Desactivar o cambiar contraseña revoca** los refresh tokens del usuario.
- Al desactivar un usuario, su access token sigue siendo válido hasta 15 min,
  pero `/auth/me` y el refresh lo rechazan porque se revalida contra la base.

### Variables de entorno nuevas

| Variable             | Obligatoria | Descripción                                                |
| -------------------- | ----------- | ---------------------------------------------------------- |
| `JWT_ACCESS_SECRET`  | Sí (32+)    | Firma del access token                                     |
| `JWT_REFRESH_SECRET` | Sí (32+)    | Pepper del hash del refresh token                          |
| `WEB_ORIGIN`         | No          | Origen(es) permitidos; por defecto `http://localhost:3000` |

`docker-compose.yml` y `.env.example` traen valores **solo de desarrollo**
(≥32 caracteres). En producción genera secretos propios, por ejemplo con
`openssl rand -base64 48`.

## Modelo de datos (Fase 1)

Prisma modela el dominio en `apps/api/prisma/schema.prisma`. Todas las tablas
viven en `snake_case` vía `@@map`, las claves primarias son UUID y el dinero es
`Decimal(14, 2)`.

```mermaid
erDiagram
  users ||--o{ refresh_tokens : tiene
  users ||--o{ price_history : registra
  users ||--o{ stock_movements : registra
  users ||--o{ sales : vende
  users ||--o{ sales : anula
  categories ||--o{ products : agrupa
  products ||--o{ price_history : historial
  products ||--o{ stock_movements : movimientos
  products ||--o{ sale_items : vendido
  sales ||--|{ sale_items : contiene
  sales ||--|| payments : paga
  sales ||--o{ stock_movements : descuenta
```

| Tabla             | Propósito                                                   |
| ----------------- | ----------------------------------------------------------- |
| `users`           | Usuarios del sistema (`ADMIN` en el MVP) con hash bcrypt    |
| `refresh_tokens`  | Sesiones renovables; se borran en cascada con el usuario    |
| `categories`      | Agrupación de productos                                     |
| `products`        | Catálogo, precios, stock y stock mínimo (borrado lógico)    |
| `price_history`   | Auditoría de cambios de `COST`/`SALE`                       |
| `stock_movements` | Entradas, ventas, ajustes y anulaciones (cantidad firmada)  |
| `sales`           | Cabecera de venta con totales, costo y utilidad             |
| `sale_items`      | Líneas con precio y costo congelados al momento de la venta |
| `payments`        | Pago único por venta (`CASH`/`CARD`) con efectivo y cambio  |

Enums: `Role { ADMIN, CASHIER }`, `PriceField { COST, SALE }`,
`StockMovementType { ENTRY, SALE, ADJUSTMENT, VOID }`,
`SaleStatus { COMPLETED, VOIDED }` y `PaymentMethod { CASH, CARD }`.

### Migraciones

| Migración                        | Contenido                                                   |
| -------------------------------- | ----------------------------------------------------------- |
| `20261107014248_init`            | Todas las tablas, índices, FKs y _check constraints_        |
| `20261107014300_sale_number_seq` | Secuencia `sale_number_seq START 1` para el número de venta |

Los _check constraints_ aplicados en SQL son: `products.stock >= 0`,
`products."costPrice" >= 0`, `products."salePrice" >= 0`,
`sale_items.quantity > 0` y `sales.total >= 0`.

`sales.number` **no** es autoincremental: la Fase 5 tomará el valor de
`nextval('sale_number_seq')` dentro de la transacción de la venta.

### Factories y seeds

`apps/api/prisma/factories` expone _builders_ puros (sin base de datos) y
funciones `create*` que reciben un `PrismaClient`:

- Builders: `buildUser`, `buildCategory`, `buildProduct`, `buildPriceHistory`,
  `buildStockMovement`, `buildSaleItem`, `buildSale` y `buildPayment`.
- Creators: `createUser`, `createCategory`, `createProduct`,
  `createPriceHistory`, `createStockMovement`, `createPayment` y `createSale`.
- `createSale` arma ítems, pago y totales coherentes: IVA del 19 % incluido en
  el precio, descuento prorrateado por línea, costo y utilidad calculados, stock
  descontado sin quedar en negativo y anulación con restauración de stock.

Ambos seeds fijan `faker.seed(2026)`, por lo que los datos son reproducibles:

| Seed | Comando          | Contenido                                                                                             |
| ---- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| Base | `pnpm seed`      | Upsert del admin, 6 categorías y 12 productos (sin ventas)                                            |
| Demo | `pnpm seed:demo` | Vacía el negocio y crea 30 productos, 40 ventas de 30 días, 6 anuladas, mermas e historial de precios |

## Comandos

| Comando                                     | Descripción                                      |
| ------------------------------------------- | ------------------------------------------------ |
| `make up`                                   | Construye y levanta `db`, `api` y `web`          |
| `make down`                                 | Detiene los contenedores (conserva el volumen)   |
| `make build`                                | Reconstruye las imágenes                         |
| `make logs` / `make ps`                     | Logs en vivo / estado                            |
| `make migrate`                              | `prisma migrate dev` sobre la base `pos`         |
| `make migrate-deploy`                       | `prisma migrate deploy` (CI/producción)          |
| `make migrate-test`                         | `prisma migrate deploy` sobre `pos_test`         |
| `make seed`                                 | Seed base (`tsx prisma/seed.ts`)                 |
| `make seed-demo`                            | Seed de demostración (`tsx prisma/seed-demo.ts`) |
| `make api-test`                             | Jest unitario de la API                          |
| `make api-e2e`                              | Migra `pos_test` y corre Jest e2e                |
| `make web-test`                             | Vitest de la web                                 |
| `make lint-api` / `make lint-web`           | ESLint                                           |
| `make typecheck-api` / `make typecheck-web` | `tsc --noEmit`                                   |

Los targets de test aceptan `FILE=` para acotar el archivo:

```bash
make api-e2e FILE=health.e2e-spec.ts
make web-test FILE=src/components/app-shell.test.tsx
```

Sin `FILE`, corren todos los archivos del proyecto. `make api-e2e` aplica antes
`prisma migrate deploy` sobre `pos_test` (`make migrate-test`).

## Pruebas de la fase 0

```bash
# 1. Imagen de la API
docker compose build api

# 2. Base de datos saludable
docker compose up -d db

# 3. e2e contra la base de tests
docker compose run --rm \
  -e DATABASE_URL=postgresql://pos:pos@db:5432/pos_test \
  api pnpm test:e2e -- health.e2e-spec.ts

# 4. Imagen de la web
docker compose build web

# 5. Test del shell de la aplicación
docker compose run --rm web pnpm test -- src/components/app-shell.test.tsx

# 6. Humo end-to-end
docker compose up -d api web
curl -f http://localhost:3001/api/v1/health
curl -f http://localhost:3000
```

## Pruebas de la fase 1

```bash
# 1. Imagen con las dependencias nuevas y el cliente Prisma regenerado
docker compose build api

# 2. Base de datos arriba
docker compose up -d db

# 3. Migraciones sobre pos (el directorio prisma se monta para persistir)
docker compose run --rm \
  -v "$PWD/apps/api/prisma:/app/apps/api/prisma" \
  -e DATABASE_URL=postgresql://pos:pos@db:5432/pos \
  api pnpm exec prisma migrate dev

# 4. Migraciones sobre pos_test + e2e del esquema
make migrate-test
make api-e2e FILE=test/schema.e2e-spec.ts

# 5. Unitarios de factories (sin base de datos)
make api-test FILE=test/factories.spec.ts

# 6. Seeds
docker compose run --rm api pnpm seed
docker compose run --rm api pnpm seed:demo

# 7. Conteos del seed demo
docker compose exec db psql -U pos -d pos -c "
SELECT 'users' t, count(*) FROM users UNION ALL
SELECT 'categories', count(*) FROM categories UNION ALL
SELECT 'products', count(*) FROM products UNION ALL
SELECT 'sales', count(*) FROM sales UNION ALL
SELECT 'sale_items', count(*) FROM sale_items UNION ALL
SELECT 'payments', count(*) FROM payments UNION ALL
SELECT 'stock_movements', count(*) FROM stock_movements;"

# 8. Calidad
make typecheck-api
make lint-api
```

## Pruebas de la fase 2

```bash
# 1. Imagen con el código nuevo (los tests corren dentro del contenedor)
docker compose build api

# 2. Base de datos arriba
docker compose up -d db

# 3. Unitarios de auth (sin base de datos)
make api-test FILE=src/modules/auth/auth.service.spec.ts
make api-test FILE=src/modules/auth/token.service.spec.ts

# 4. e2e de autenticación y usuarios (aplican migraciones sobre pos_test)
make api-e2e FILE=test/auth.e2e-spec.ts
make api-e2e FILE=test/users.e2e-spec.ts

# 5. Calidad
make lint-api
make typecheck-api

# 6. Humo manual con curl (cookie jar)
docker compose up -d api
curl -i -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"admin@pos.local","password":"Admin123!"}' \
  http://localhost:3001/api/v1/auth/login
curl -b cookies.txt http://localhost:3001/api/v1/auth/me
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3001/api/v1/auth/refresh
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3001/api/v1/auth/logout
```

Los e2e cubren: login 200 con cookies `httpOnly` y sin tokens en el body, login
`401` (clave errónea y usuario inactivo), `me` con y sin cookie, `Bearer`,
rotación del refresh con rechazo del token viejo, detección de reuso, logout con
revocación, `429` al sexto intento y `403` con `Origin` no permitido; además,
`/users` sin sesión (`401`), con rol `CASHIER` (`403`), listado paginado con
búsqueda y filtro, alta, email duplicado (`409`), validación (`400`), cambio de
contraseña, desactivación, `404` y autodesactivación bloqueada.

Cada archivo e2e limpia la base con `resetDatabase` y reinicia el rate limit,
así que el `429` no vuelve flaky a los demás casos.

## Credenciales

El seed (`pnpm seed` y `pnpm seed:demo`) crea el administrador del MVP:

| Usuario           | Contraseña  | Rol     |
| ----------------- | ----------- | ------- |
| `admin@pos.local` | `Admin123!` | `ADMIN` |

La contraseña se guarda con bcrypt (coste 12) y se restablece en cada corrida
del seed. `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` son **obligatorias** y
deben tener al menos 32 caracteres (`src/config/env.validation.ts`); el arranque
falla si faltan o son cortas.

## Notas técnicas

- **NestJS 12 es ESM**: el paquete declara `"type": "module"`, los imports
  relativos llevan extensión `.js` y el proyecto compila con `module: nodenext`.
- **Prisma 7** genera el cliente con el generator `prisma-client` en
  `apps/api/src/generated/prisma` (ignorado por git, en TypeScript) y requiere un
  _driver adapter_; `PrismaService` usa `PrismaPg`. La URL de la base se lee de
  `prisma.config.ts`, no del `schema.prisma`.
- **Factories y seeds fuera de `src`**: `tsconfig.json` incluye `prisma/**/*.ts`
  para que `typecheck` y ESLint también los cubran; `tsconfig.build.json` sigue
  compilando solo `src`.
- **Seeds con tsx**: `prisma.config.ts` declara `seed: 'tsx prisma/seed.ts'` y
  `tsx` resuelve los imports `.js` de los archivos TypeScript. Las factories
  comparten `prisma/client.ts` (crea el `PrismaClient` con `PrismaPg`) para no
  depender de Nest.
- **Migraciones persistidas**: el directorio `apps/api/prisma` se monta solo al
  generar/aplicar migraciones; el resto del código vive en la imagen, así que
  cualquier cambio exige `docker compose build api`.
- **Jest en ESM** requiere `NODE_OPTIONS=--experimental-vm-modules`; los scripts
  `test` y `test:e2e` ya lo incluyen.
- **JWT sin dependencias**: `JwtService` firma y verifica HS256 con
  `node:crypto` (HMAC + comparación en tiempo constante), así que `jsonwebtoken`,
  `@nestjs/jwt` y `@nestjs/throttler` no se agregaron al proyecto. El rate limit
  vive en `src/common/rate-limit` (memoria por proceso) y expone `reset()` para
  los tests; en varias instancias habría que compartirlo (Redis).
- **Configuración compartida**: `src/app.setup.ts` aplica prefijo global,
  `ValidationPipe`, `helmet`, `cookie-parser` y CORS tanto en `main.ts` como en
  los e2e, de modo que las pruebas usan la misma pila que producción.
- **`enableImplicitConversion` y booleanos**: `class-transformer` convierte
  `'false'` a `true` al inferir `Boolean`, por eso `active` en el query de
  `/users` se valida como `'true' | 'false'` y se traduce en el servicio.
- **Tailwind 4** define los tokens Material You con `@theme inline` sobre
  variables CSS, por lo que el modo oscuro funciona con `prefers-color-scheme`
  sin prefijos `dark:`.
