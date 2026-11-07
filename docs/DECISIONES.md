# Decisiones de arquitectura (ADR) — POS

> **Propósito:** registrar, en formato corto y verificable, las decisiones técnicas que explican la forma actual del POS **v1.0.0**. Cada ADR indica dónde vive la decisión en el código.
>
> **Criterio:** solo se documentan decisiones realmente implementadas. Las ideas descartadas aparecen únicamente en la sección “Decisiones descartadas”.
>
> **Documentos relacionados:** [Arquitectura](ARQUITECTURA.md) · [API](API.md) · [Modelo de datos](MODELO-DATOS.md) · [README](../README.md)

## Índice

- [ADR-001 — Prisma 7 con driver adapter `PrismaPg`](#adr-001--prisma-7-con-driver-adapter-prismapg)
- [ADR-002 — Cliente Prisma generado y excluido de git](#adr-002--cliente-prisma-generado-y-excluido-de-git)
- [ADR-003 — JWT propio sobre `node:crypto`](#adr-003--jwt-propio-sobre-nodecrypto)
- [ADR-004 — Cookies `httpOnly` con refresh rotativo](#adr-004--cookies-httponly-con-refresh-rotativo)
- [ADR-005 — Rate limit en memoria](#adr-005--rate-limit-en-memoria)
- [ADR-006 — Filtro global de errores uniforme](#adr-006--filtro-global-de-errores-uniforme)
- [ADR-007 — Aritmética monetaria en centavos enteros](#adr-007--aritmética-monetaria-en-centavos-enteros)
- [ADR-008 — Índices compuestos de rendimiento](#adr-008--índices-compuestos-de-rendimiento)
- [ADR-009 — ESM en NestJS 12](#adr-009--esm-en-nestjs-12)
- [ADR-010 — pnpm con layout hoisted](#adr-010--pnpm-con-layout-hoisted)
- [ADR-011 — Sin bind mounts: el código vive en las imágenes](#adr-011--sin-bind-mounts-el-código-vive-en-las-imágenes)
- [ADR-012 — Sin WebSockets, SSE ni polling](#adr-012--sin-websockets-sse-ni-polling)
- [ADR-013 — Material You con tokens CSS y Tailwind 4](#adr-013--material-you-con-tokens-css-y-tailwind-4)
- [ADR-014 — Zustand para el carrito del POS](#adr-014--zustand-para-el-carrito-del-pos)
- [ADR-015 — Gráficos SVG sin librería](#adr-015--gráficos-svg-sin-librería)
- [ADR-016 — Regla de tests por fase](#adr-016--regla-de-tests-por-fase)
- [ADR-017 — Cobertura con umbrales y targets dedicados](#adr-017--cobertura-con-umbrales-y-targets-dedicados)
- [ADR-018 — Restricciones de dominio en SQL](#adr-018--restricciones-de-dominio-en-sql)
- [ADR-019 — Un solo rol operativo en el MVP](#adr-019--un-solo-rol-operativo-en-el-mvp)
- [ADR-020 — Swagger como contrato vivo](#adr-020--swagger-como-contrato-vivo)
- [Decisiones descartadas](#decisiones-descartadas)

---

### ADR-001 — Prisma 7 con driver adapter `PrismaPg`

> **Estado:** Aceptado · **Verificado en:** `apps/api/src/prisma/prisma.service.ts`, `apps/api/prisma.config.ts`, `apps/api/package.json`

**Contexto.** Prisma 7 deja de leer la URL de conexión desde `schema.prisma` y exige un _driver adapter_ para el cliente.

**Decisión.** El `datasource` del schema no lleva `url`: vive en `prisma.config.ts` (`datasource.url: process.env.DATABASE_URL`). `PrismaService` instancia el cliente con `new PrismaPg({ connectionString })` y `@prisma/adapter-pg` / `pg` están como dependencias explícitas.

**Consecuencias.**

- Las pruebas e2e pueden apuntar a `pos_test` solo cambiando `DATABASE_URL` (los helpers las arrancan con esa variable).
- Las factories y seeds crean su propio cliente con `prisma/client.ts`, sin depender de Nest.
- Cambiar de motor obligaría a cambiar también el adapter.

### ADR-002 — Cliente Prisma generado y excluido de git

> **Estado:** Aceptado · **Verificado en:** `apps/api/prisma/schema.prisma` (generator `prisma-client`), `.dockerignore`, `.github/workflows/ci.yml`

**Contexto.** El cliente generado es código derivado y grande; versionarlo genera ruido y conflictos.

**Decisión.** El generator `prisma-client` escribe en `../src/generated/prisma`, la carpeta está ignorada por git y `.dockerignore`, y **todo** el que consuma el proyecto ejecuta `prisma generate` antes: el `Dockerfile` de la API en el stage `dev`/`build` y los cinco jobs de CI.

**Consecuencias.**

- `collectCoverageFrom` y ESLint excluyen `src/generated/**`.
- Un clon nuevo debe pasar por Docker o por `pnpm --filter @pos/api prisma:generate` antes de compilar.

### ADR-003 — JWT propio sobre `node:crypto`

> **Estado:** Aceptado · **Verificado en:** `apps/api/src/modules/auth/jwt.service.ts`, `apps/api/package.json`

**Contexto.** La API necesita firmar y verificar un JWT HS256 de 15 minutos; el proyecto ya prohíbe dependencias innecesarias.

**Decisión.** `JwtService` firma y verifica HS256 con `createHmac` de `node:crypto`, comparación en tiempo constante y validación de `exp` y `alg`. **No** se agregaron `jsonwebtoken`, `@nestjs/jwt` ni `@nestjs/throttler` (tampoco aparecen en `package.json`).

**Consecuencias.**

- Menos superficie de dependencias y control total del payload (`sub`, `email`, `role`).
- Si se necesitara otro algoritmo (RS256, EdDSA) habría que implementarlo a mano.

### ADR-004 — Cookies `httpOnly` con refresh rotativo

> **Estado:** Aceptado · **Verificado en:** `auth-cookies.ts`, `auth.constants.ts`, `token.service.ts`, `common/guards/jwt-auth.guard.ts`

**Contexto.** La web es un front same-origin y no debe exponer tokens a JavaScript.

**Decisión.** La sesión viaja en cookies `httpOnly` (`access_token` en `Path=/`, `refresh_token` en `Path=/api/v1/auth`), el body nunca incluye tokens, el refresh es un token opaco de 64 bytes cuyo **HMAC-SHA256** (con `JWT_REFRESH_SECRET` como _pepper_) es lo único que se persiste, y cada `refresh` **rota** el token. Presentar un refresh ya revocado se trata como reuso: se revocan todas las sesiones del usuario.

**Consecuencias.**

- El access token sobrevive hasta 15 minutos tras el logout (JWT sin estado); el refresh sí queda revocado.
- Cambiar la contraseña o desactivar al usuario revoca sus refresh tokens.
- La web compensa la expiración con un único refresh en vuelo (`api-client.ts`).

### ADR-005 — Rate limit en memoria

> **Estado:** Aceptado · **Verificado en:** `apps/api/src/common/rate-limit/rate-limit.service.ts`, `rate-limit.guard.ts`

**Contexto.** Hace falta limitar peticiones por IP y ruta, con un límite duro en el login, sin sumar infraestructura.

**Decisión.** Contadores en un `Map` del proceso, clave `MÉTODO:ruta:IP`, ventana fija con barrido de vencidos cada 60 s, 600 req/min globales y 5 req/min en `POST /auth/login` vía `@Throttle`. Se exponen `X-RateLimit-Limit` / `X-RateLimit-Remaining` y `Retry-After` en el `429`. `reset()` permite aislar los tests.

**Consecuencias.**

- Funciona con una sola instancia. Con varias habría que compartir el contador (Redis u otro almacén) — el servicio es el único punto a cambiar.
- El orden de guards es rate limit → `Origin` → auth → roles: una petición rechazada por `Origin` ya consumió su cupo de la ventana.

### ADR-006 — Filtro global de errores uniforme

> **Estado:** Aceptado · **Verificado en:** `apps/api/src/common/filters/http-exception.filter.ts`, `common/dto/error-response.dto.ts`

**Contexto.** Cada módulo lanzaba excepciones de Nest con cuerpos distintos y el cliente tenía que adivinar la forma del error.

**Decisión.** `HttpExceptionFilter` registrado con `APP_FILTER` normaliza **toda** salida a `{ statusCode, message, error, timestamp, path }`, conserva `message` como arreglo cuando viene del `ValidationPipe`, replica cabeceras de las `HttpException` (como `Retry-After`) y convierte cualquier error no HTTP en un `500` genérico registrando el stack solo en el log.

**Consecuencias.**

- Swagger documenta la misma forma en todos los endpoints (`ErrorResponseDto`).
- La web puede mostrar el mensaje de negocio sin ramas por endpoint (`extractErrorMessage`).
- Los errores 5xx no filtran detalles internos al cliente.

### ADR-007 — Aritmética monetaria en centavos enteros

> **Estado:** Aceptado · **Verificado en:** `apps/api/src/modules/sales/sales.calculator.ts`, `apps/web/src/lib/cart-totals.ts`

**Contexto.** Los importes en COP con IVA incluido y descuentos prorrateados producen residuos de redondeo si se opera con `number` decimal.

**Decisión.** Todo el cálculo se hace en **centavos enteros** (`toCents` / `fromCents`), con `IVA_DIVISOR = 1.19`, reparto del residuo del descuento de a un centavo y conversión a `Decimal(14,2)` solo al persistir. La web replica el mismo algoritmo en `cart-totals.ts` para que el total mostrado coincida con el que cobrará la API.

**Consecuencias.**

- Un test de coherencia entre carrito y servidor es verificable línea a línea.
- Cualquier cambio de fórmula debe hacerse en los dos archivos y en `sales.calculator.spec.ts`.

### ADR-008 — Índices compuestos de rendimiento

> **Estado:** Aceptado (Fase 12, cierre técnico) · **Verificado en:** `apps/api/prisma/migrations/20261107162329_perf_indexes/migration.sql`, `schema.prisma`

**Contexto.** Los listados y KPIs filtran siempre por el mismo par de columnas: catálogo activo y no eliminado, ventas `COMPLETED` dentro de un rango y movimientos `ADJUSTMENT` dentro de un rango.

**Decisión.** Añadir tres índices compuestos que cubren esos filtros: `products(active, deletedAt)`, `sales(status, createdAt)` y `stock_movements(type, createdAt)`, manteniendo los índices simples previos.

**Consecuencias.**

- Consultas del dashboard y de los listados dejan de depender de índices de una sola columna.
- Coste de escritura ligeramente mayor en las tres tablas; el volumen del POS lo hace irrelevante.

### ADR-009 — ESM en NestJS 12

> **Estado:** Aceptado · **Verificado en:** `apps/api/package.json`, `tsconfig*.json`, `jest.config.js`

**Contexto.** NestJS 12 y sus dependencias ya son ESM de forma nativa.

**Decisión.** El paquete declara `"type": "module"`, los imports relativos llevan extensión `.js` y la compilación usa `module: nodenext`. Los scripts de Jest inyectan `NODE_OPTIONS=--experimental-vm-modules` y `ts-jest` corre con `useESM`, con un `moduleNameMapper` que resuelve `./x.js` → `./x`.

**Consecuencias.**

- Cualquier archivo nuevo debe repetir la extensión `.js` en sus imports relativos.
- Las herramientas que no soportan ESM habría que cargarlas aparte.

### ADR-010 — pnpm con layout `hoisted`

> **Estado:** Aceptado · **Verificado en:** `pnpm-workspace.yaml`, `.npmrc`, `apps/*/Dockerfile`

**Contexto.** Las imágenes de Docker copian `node_modules` entre stages y necesitan la misma forma de árbol que el host.

**Decisión.** `nodeLinker: hoisted` (árbol plano, sin symlinks de pnpm), `saveExact`, `minimumReleaseAge: 0`, `allowBuilds` solo para los paquetes que lo requieren, `autoInstallPeers` activo y un `override` que fija TypeScript 5.9.3 en todo el workspace.

**Consecuencias.**

- `node_modules` se puede copiar tal cual entre stages (`deps` → `dev`/`build` → `prod`).
- Pnpm 12 lee la configuración del workspace desde `pnpm-workspace.yaml`: `.npmrc` solo fija el registry.

### ADR-011 — Sin bind mounts: el código vive en las imágenes

> **Estado:** Aceptado · **Verificado en:** `docker-compose.yml`, `Makefile`, `.dockerignore`

**Contexto.** Montar el código del host dentro del contenedor produce diferencias entre máquinas y obliga a tener `node_modules` local.

**Decisión.** Solo se monta `infra/postgres/init.sql` (como script de inicialización) y, en los targets `migrate` / `migrate-test`, `apps/api/prisma` para persistir el SQL generado. El resto del código se copia a la imagen.

**Consecuencias.**

- Tras cambiar código hay que reconstruir (`make build`, `make up`); el `--watch` de Nest no ve el host.
- El host no necesita Node ni pnpm (ver [README](../README.md#requisitos)).

### ADR-012 — Sin WebSockets, SSE ni polling

> **Estado:** Aceptado · **Verificado en:** `apps/web/src/components/providers/query-provider.tsx`, `apps/web/src/lib/*`

**Contexto.** El POS es de un solo operador por terminal y no necesita datos en vivo.

**Decisión.** El estado remoto se pide bajo demanda con TanStack Query (`retry: 1`, `refetchOnWindowFocus: false`, `staleTime: 30 s`) y se invalida tras cada mutación. No hay WebSockets, SSE, ni temporizadores de sondeo, ni caché externa.

**Consecuencias.**

- Una segunda caja no ve los cambios en tiempo real: hay que recargar o navegar (el `staleTime` fuerza datos frescos al volver a la pantalla).
- Menos superficie operativa: la API no mantiene conexiones vivas.

### ADR-013 — Material You con tokens CSS y Tailwind 4

> **Estado:** Aceptado · **Verificado en:** `apps/web/src/app/globals.css`, `apps/web/src/components/theme/`

**Contexto.** Se quiere una identidad Material You sin introducir colores literales sueltos por los componentes.

**Decisión.** Los tokens `--md-*` se derivan de la semilla `#1a237e` y se declaran en `:root`, en `prefers-color-scheme: dark` y en `:root[data-theme='dark'|'light']` (el tema explícito gana siempre sobre el sistema). Tailwind 4 los recibe vía `@theme inline` como utilidades (`bg-surface-container`, `text-on-surface-variant`, …), y `ThemeToggle` solo alterna el atributo `data-theme`.

**Consecuencias.**

- El modo oscuro funciona sin prefijos `dark:` ni duplicar clases.
- Un color nuevo exige añadirlo como token, no como valor literal.

### ADR-014 — Zustand para el carrito del POS

> **Estado:** Aceptado · **Verificado en:** `apps/web/src/stores/cart-store.ts`, `apps/web/src/lib/cart-totals.ts`

**Contexto.** El carrito es estado de cliente puro (no existe en la API hasta que se registra la venta) y el POS se maneja con teclado.

**Decisión.** Un store de Zustand con `persist` sobre `localStorage` (`pos-cart`), `partialize` limitado a `items` y `discountAmount`, `skipHydration` para no romper el SSR (respaldo en memoria cuando no hay `window`) y saneamiento en cada acción: cantidades recortadas a `[0, stock]` y descuento normalizado a `>= 0` con dos decimales.

**Consecuencias.**

- El carrito sobrevive a un recargado de la página y el servidor no guarda borradores.
- `computeCartTotals` debe seguir replicando la aritmética de la API (ADR-007).

### ADR-015 — Gráficos SVG sin librería

> **Estado:** Aceptado · **Verificado en:** `apps/web/src/components/dashboard/sales-chart.tsx`

**Contexto.** El dashboard solo necesita un gráfico de barras de la tendencia de ventas.

**Decisión.** `SalesChart` dibuja un único `<svg>` con `viewBox` fijo, barras `<rect>` calculadas en el componente, `<title>` nativo por barra (tooltip sin JavaScript adicional) y estados de carga, error y vacío propios. **No** se añadieron librerías de gráficos a `apps/web/package.json`.

**Consecuencias.**

- Cero dependencias y accesibilidad por `role="img"` + etiquetas `aria`.
- Cualquier gráfico nuevo (área, líneas, múltiples series) hay que construirlo igual.

### ADR-016 — Regla de tests por fase

> **Estado:** Aceptado · **Verificado en:** `Makefile`, `AGENTS.md`, `apps/*` (specs por fase)

**Contexto.** La suite completa dentro de un contenedor es lenta y en fases tempranas no aporta señal.

**Decisión.** Durante las fases funcionales se ejecutan solo los tests de la fase, siempre acotados con `FILE=` (que admite varios patrones separados por espacio). La **suite completa se ejecuta únicamente en el cierre técnico** (Fase 12), que es cuando se ejecutó por última vez.

**Consecuencias.**

- Los targets `api-test`, `api-e2e` y `web-test` siguen aceptando `FILE=` para acotar.
- Un cambio transversal obliga a correr la suite completa a mano.

### ADR-017 — Cobertura con umbrales y targets dedicados

> **Estado:** Aceptado (Fase 12) · **Verificado en:** `apps/api/jest.config.js`, `apps/web/vitest.config.ts`, `Makefile`

**Contexto.** Hacía falta una puerta objetiva de calidad medible en el cierre.

**Decisión.** Fijar umbrales de cobertura y añadir los targets que los hacen cumplir:

| Suite              | Umbral (statements / lines / branches) | Target                |
| :----------------- | :------------------------------------: | :-------------------- |
| API unitarios      | `70 / 70 / 60`                         | `make api-test-cov`   |
| API e2e            | sin umbral (cobertura informativa)     | `make api-e2e-cov`    |
| Web                | `60 / 60 / 50`                         | `make web-test-cov`   |
| Todo junto         | —                                      | `make test-all`       |

**Consecuencias.**

- Medido en el cierre: API unitarios `86.18 %` statements / `69.03 %` branches / `87.04 %` líneas; web `64.43 %` / `61.70 %` / `64.43 %`; e2e informativo (`43.20 %` / `60.52 %` / `42.79 %`, sin umbral).
- La cobertura e2e **no** se suma a la unitaria: son `coverageDirectory` distintos (`coverage/unit`, `coverage/e2e`).
- Los umbrales se aplican en cada corrida: bajar la cobertura rompe la suite.

### ADR-018 — Restricciones de dominio en SQL

> **Estado:** Aceptado · **Verificado en:** `apps/api/prisma/migrations/20261107014248_init/migration.sql`

**Contexto.** Prisma no expresa `CHECK` de dominio en el schema.

**Decisión.** Escribirlos a mano en la migración inicial: `products.stock >= 0`, `products."costPrice" >= 0`, `products."salePrice" >= 0`, `sale_items.quantity > 0` y `sales.total >= 0`.

**Consecuencias.**

- La base es la última línea de defensa aunque un servicio tenga un error.
- `prisma migrate diff` no los ve: hay que conservarlos manualmente en migraciones futuras.

### ADR-019 — Un solo rol operativo en el MVP

> **Estado:** Aceptado · **Verificado en:** `apps/api/prisma/schema.prisma` (`enum Role`), `users.service.ts`

**Contexto.** El POS se opera desde una terminal administrada.

**Decisión.** El enum `Role` admite `ADMIN` y `CASHIER`, `RolesGuard` ya valida roles, pero la API solo crea usuarios `ADMIN` y todas las rutas de negocio exigen `ADMIN`. Las rutas públicas son `health`, `login` y `refresh`.

**Consecuencias.**

- Habilitar cajeros es agregar `@Roles(Role.CASHIER)` y permitir el rol en el alta, sin tocar el esquema.
- Hoy un usuario sin `ADMIN` recibe `403` en todo el negocio.

### ADR-020 — Swagger como contrato vivo

> **Estado:** Aceptado · **Verificado en:** `apps/api/src/main.ts`, `*.controller.ts`, `common/dto/error-response.dto.ts`

**Contexto.** El frontend y las pruebas manuales necesitan un contrato siempre actualizado.

**Decisión.** Swagger UI en `/api/docs` con JSON en `/api/docs/json`, versión `1.0.0`, `addCookieAuth` para `access_token` y `refresh_token`, una etiqueta (`@ApiTag`) por módulo y, en cada endpoint, `@ApiOperation`, DTOs con `@ApiProperty`/ejemplos y todas las respuestas de error tipadas con `ErrorResponseDto`. La documentación en Markdown ([API](API.md)) es el mapa; Swagger es la fuente.

**Consecuencias.**

- Un endpoint nuevo sin documentar es un fallo de revisión.
- `WEB_ORIGIN` debe incluir `http://localhost:3001` para probar mutaciones desde la propia UI ([API](API.md#6-probar-mutaciones-desde-swagger-ui)).

---

## Decisiones descartadas

| Idea                                        | Por qué no se implementó                                                                                        |
| :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------- |
| `jsonwebtoken` / `@nestjs/jwt`              | La firma HS256 con `node:crypto` es suficiente y evita dependencias (ADR-003).                                   |
| `@nestjs/throttler`                         | El rate limit propio (~60 líneas) permite `reset()` en los tests y cabeceras a medida (ADR-005).                 |
| Redis como contador compartido              | El MVP corre con una instancia de API; el `RateLimitService` es el único punto a cambiar si deja de ser así.      |
| Persistir el carrito en la API              | El carrito es estado de UI; la venta solo existe al registrarse en una transacción (ADR-014).                    |
| WebSockets / SSE / polling                  | No hay necesidad de datos en vivo en una caja por terminal (ADR-012).                                           |
| Librería de gráficos (Recharts, Chart.js…)  | Un SVG de barras hecho a mano cubre el caso sin dependencias (ADR-015).                                          |
| Bind mounts para desarrollo                 | Producen diferencias entre máquinas y exigen `node_modules` en el host (ADR-011).                                |

---

## Enlaces

- [Arquitectura](ARQUITECTURA.md) — consecuencia estructural de estas decisiones.
- [API](API.md) — contrato derivado de ADR-004, ADR-005, ADR-006 y ADR-020.
- [Modelo de datos](MODELO-DATOS.md) — ADR-001, ADR-002, ADR-007, ADR-008 y ADR-018.
- [README](../README.md) — comandos que ejecutan estos acuerdos.

## Etiquetas

#decisiones #adr #nestjs #nextjs #prisma #docker #pos
