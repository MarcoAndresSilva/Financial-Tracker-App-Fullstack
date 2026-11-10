# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Financial Tracker — a full-stack personal-finance tracker. NestJS + Prisma + PostgreSQL backend, Angular 19 (standalone components) + Angular Material + ngx-charts frontend, containerized with Docker Compose.

**The authoritative progress log is `ARCHITECTURE.md`** — a step-by-step development diary ("Paso 1", "Paso 2", ...) documenting every architectural decision as it was made. It is updated after every feature with a dedicated `docs(architecture): ...` commit that immediately follows the `feat/fix/refactor` commit implementing it. Read it before making non-trivial changes, and keep extending it in the same style/numbering when adding new steps — don't let it fall out of sync with the code.

## Commands

### Backend (`backend/`)
- `npm run start:dev` — start NestJS in watch mode
- `npm run build` — `prisma generate && nest build`
- `npx prisma migrate dev` — create/apply a migration after editing `prisma/schema.prisma`
- `npx prisma generate` — regenerate the Prisma client (needed after pulling schema changes)
- `npm run lint` — eslint --fix
- `npm test` — jest unit tests (`src/**/*.spec.ts`); single file: `npx jest path/to/file.spec.ts`
- `npm run test:e2e` — e2e suite (`test/**/*.e2e-spec.ts`) against the real app and the `fintrack_test` database (see **Pruebas** below)

### Frontend (`frontend/`)
- `npm start` (`ng serve`) — dev server
- `npm run build` (`ng build`)
- `npm test` (`ng test`) — Karma/Jasmine

### Full stack
- `docker-compose up -d --build` from the repo root — runs `api` + `db` (Postgres) services. API is exposed on `http://localhost:3000`.
- The `Dockerfile` is multi-stage; `prisma generate` must run before `nest build`, and the final stage must copy `node_modules` from the `build` stage (not a fresh `dependencies` install) or Prisma fails to initialize at runtime.

## Architecture

### Backend (`backend/src/`)
NestJS modules, one per domain: `auth/`, `user/`, `wallet/`, `category/`, `subcategory/`, `transaction/`, `debt/`, `savings-goal/`, `dashboard/`, `mail/`, plus `prisma/` (wraps the Prisma client as `PrismaService`/`PrismaModule`), `common/decorators/current-user.decorator.ts` (`@CurrentUser()` pulls `req.user`) and `common/permissions/`. Global app config (CORS, `ValidationPipe`) lives in `app.setup.ts` → `configureApp(app)`, shared by `main.ts` and the e2e tests.

- **Auth**: `POST /auth/signup` and `POST /auth/signin` are the only public routes. JWT via Passport (`passport-jwt`), stateless, 60-minute expiry, **no refresh token**. `JwtStrategy` re-fetches the full `User` (with `memberships.wallet`) from the DB on every authenticated request. All other controllers are guarded with `@UseGuards(AuthGuard('jwt'))` at the class level.
- **Data model** (`backend/prisma/schema.prisma`): `User` —< `WalletMembership` >— `Wallet` (`PERSONAL`/`SHARED`, role `OWNER`/`MEMBER`) —< `Category` —< `Subcategory` —< `Transaction`. Signup atomically creates a `User` + personal `Wallet` + `WalletMembership` via a Prisma nested write.
- **Authorization pattern**: every service that touches wallet-scoped data calls `PermissionsService.checkWalletMembership(userId, walletId, ownerRequired)` (`common/permissions/`, extracted in Paso 44) before acting; it throws `ForbiddenException` (403). Any new wallet-scoped endpoint must do the same **and** get a row in the intruder table of `test/authorization.e2e-spec.ts`.
- **Dashboard aggregates**: `DashboardService` uses Prisma `aggregate`/`groupBy` to compute wallet summaries and expenses-by-category, scoped by `walletId` query param.

### Frontend (`frontend/src/app/`)
Standalone components (no NgModules except the Material aggregator), functional bootstrap (`provideRouter`, `provideHttpClient` in `app.config.ts`).

- `auth/` — login/register pages + `AuthService`
- `core/` — `guards/auth.guard.ts` (checks `localStorage['access_token']`), `interceptors/auth.interceptor.ts` (attaches `Authorization: Bearer <token>` to every request), `services/wallet-context.service.ts`
- `dashboard/` — `layout/` (sidenav/toolbar shell wrapping `<router-outlet>`) and `pages/` (`home`, `transaction-list`)
- `transactions/`, `categories/`, `subcategories/`, `user/` — one `services/` (+ sometimes `components/`) folder per domain
- `shared/` — `material/material.module.ts` exports a `MATERIAL_MODULES` array spread into each standalone component's `imports`; `components/` has reusable `ConfirmDialogComponent` and `LoadingSpinnerComponent`

**Central state**: `WalletContextService` (`core/services/`) holds the active wallet in a `BehaviorSubject<Wallet | null>` (`activeWallet$`), populated by `loadUserWallets()` after login. Feature pages (`HomeComponent`, `TransactionListComponent`) subscribe to `activeWallet$` (with `takeUntil(destroy$)` to avoid leaks) and re-fetch their data whenever it changes — this is the pattern to follow for any new wallet-scoped page.

API base URL comes from `src/environments/environment.ts` / `environment.prod.ts` (`environment.apiUrl`); new services must use it, never a hardcoded URL.

### Working convention
When adding a feature: write its contract and tests first (see **Pruebas**), implement it, verify it in the real browser, commit the code (`feat(...)`/`fix(...)`/`refactor(...)`), then extend `ARCHITECTURE.md` with a new numbered "Paso" describing what was built and why, and commit that separately as `docs(architecture): ...` — this is the established pattern across all prior history in this repo.

## Pruebas — cómo trabajamos (desde el Paso 74)

**Principio:** contrato primero, tests del contrato después, implementación al final, y siempre verificación en el navegador real. Los tests aislados no reemplazan esa última prueba: los bugs de integración (ciclo de vida de Angular, peticiones en paralelo, doble clic) solo aparecen ahí.

**Qué se testea, por prioridad (según qué duele más si falla):**
1. **Autorización (backend e2e)** — nadie lee ni modifica datos de una wallet ajena. `test/authorization.e2e-spec.ts` tiene una tabla de casos: todo endpoint nuevo que toque datos de una wallet agrega su fila.
2. **Cálculos de plata (backend unit)** — saldos, remanente, progreso de deudas, estado de presupuestos. Se escriben como **funciones puras** (entra esto → sale este número, sin base de datos) en un archivo propio junto al servicio, con su `.spec.ts` al lado. Si un cálculo está enredado dentro de un servicio, se extrae antes de testearlo.
3. **Flujos críticos del usuario (Playwright)** — login, crear transacción sin duplicados, recarga con F5, cambio de wallet.

**Qué NO se hace:** perseguir un porcentaje de cobertura, ni testear componentes de Angular uno por uno.

**Para cada feature nueva:**
1. Definir el contrato: modelo Prisma, DTOs, y las funciones puras con su firma.
2. Escribir los tests del contrato (casos normales + bordes: cero, negativos, fin de mes, sin datos).
3. Implementar hasta que pasen.
4. Agregar los endpoints nuevos a la tabla de autorización.
5. Probar en el navegador real.
6. Un test nuevo debe **fallar** al menos una vez antes de pasar (o romper el código a propósito y ver que lo detecta): un test que nunca falló no demuestra nada.

**Infraestructura e2e del backend:**
- Base de pruebas `fintrack_test` en el mismo contenedor Postgres (`financial_tracker_db`). Si no existe: `docker exec financial_tracker_db createdb -U user fintrack_test`. Las migraciones se aplican solas al correr la suite (`test/global-setup.ts`).
- `test/setup-env.ts` fuerza `DATABASE_URL` a la base de pruebas (o a `TEST_DATABASE_URL` si está definida) y **aborta si el nombre de la base no contiene "test"**: la suite vacía la base en cada archivo.
- `test/helpers/test-app.ts` → `createTestApp()` (app completa con `configureApp`) y `resetDatabase()`. `test/helpers/factories.ts` → `createUser()` y `seedWallet()`, que crean datos **a través de la API**, no escribiendo directo en la base.
- La suite corre en serie (`maxWorkers: 1`) porque todos los archivos comparten la base.
