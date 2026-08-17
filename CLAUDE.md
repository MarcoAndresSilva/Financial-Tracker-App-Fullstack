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
- `npm test` — jest unit tests; `npm run test:e2e` for e2e; single file: `npx jest path/to/file.spec.ts`

### Frontend (`frontend/`)
- `npm start` (`ng serve`) — dev server
- `npm run build` (`ng build`)
- `npm test` (`ng test`) — Karma/Jasmine

### Full stack
- `docker-compose up -d --build` from the repo root — runs `api` + `db` (Postgres) services. API is exposed on `http://localhost:3000`.
- The `Dockerfile` is multi-stage; `prisma generate` must run before `nest build`, and the final stage must copy `node_modules` from the `build` stage (not a fresh `dependencies` install) or Prisma fails to initialize at runtime.

## Architecture

### Backend (`backend/src/`)
NestJS modules, one per domain: `auth/`, `user/`, `category/`, `subcategory/`, `transaction/`, `dashboard/`, plus `prisma/` (wraps the Prisma client as `PrismaService`/`PrismaModule`) and `common/decorators/current-user.decorator.ts` (`@CurrentUser()` pulls `req.user`).

- **Auth**: `POST /auth/signup` and `POST /auth/signin` are the only public routes. JWT via Passport (`passport-jwt`), stateless, 60-minute expiry, **no refresh token**. `JwtStrategy` re-fetches the full `User` (with `memberships.wallet`) from the DB on every authenticated request. All other controllers are guarded with `@UseGuards(AuthGuard('jwt'))` at the class level.
- **Data model** (`backend/prisma/schema.prisma`): `User` —< `WalletMembership` >— `Wallet` (`PERSONAL`/`SHARED`, role `OWNER`/`MEMBER`) —< `Category` —< `Subcategory` —< `Transaction`. Signup atomically creates a `User` + personal `Wallet` + `WalletMembership` via a Prisma nested write.
- **Authorization pattern**: each service that touches wallet-scoped data (`CategoryService`, `SubcategoryService`, `TransactionService`) calls a `checkWalletMembership(userId, walletId, ownerRequired)` helper before acting. This helper is currently **duplicated** across services — extracting it into a shared `PermissionsService` is a known, explicitly-flagged TODO (see `ARCHITECTURE.md`, Paso 7).
- **Dashboard aggregates**: `DashboardService` uses Prisma `aggregate`/`groupBy` to compute wallet summaries and expenses-by-category, scoped by `walletId` query param.

### Frontend (`frontend/src/app/`)
Standalone components (no NgModules except the Material aggregator), functional bootstrap (`provideRouter`, `provideHttpClient` in `app.config.ts`).

- `auth/` — login/register pages + `AuthService`
- `core/` — `guards/auth.guard.ts` (checks `localStorage['access_token']`), `interceptors/auth.interceptor.ts` (attaches `Authorization: Bearer <token>` to every request), `services/wallet-context.service.ts`
- `dashboard/` — `layout/` (sidenav/toolbar shell wrapping `<router-outlet>`) and `pages/` (`home`, `transaction-list`)
- `transactions/`, `categories/`, `subcategories/`, `user/` — one `services/` (+ sometimes `components/`) folder per domain
- `shared/` — `material/material.module.ts` exports a `MATERIAL_MODULES` array spread into each standalone component's `imports`; `components/` has reusable `ConfirmDialogComponent` and `LoadingSpinnerComponent`

**Central state**: `WalletContextService` (`core/services/`) holds the active wallet in a `BehaviorSubject<Wallet | null>` (`activeWallet$`), populated by `loadUserWallets()` after login. Feature pages (`HomeComponent`, `TransactionListComponent`) subscribe to `activeWallet$` (with `takeUntil(destroy$)` to avoid leaks) and re-fetch their data whenever it changes — this is the pattern to follow for any new wallet-scoped page.

No `environment.ts` exists yet — every feature service currently hardcodes `http://localhost:3000` as its API base URL independently; be aware of this when adding a new service (six existing services repeat the same literal).

### Working convention
When adding a feature: implement it, test it manually, commit the code (`feat(...)`/`fix(...)`/`refactor(...)`), then extend `ARCHITECTURE.md` with a new numbered "Paso" describing what was built and why, and commit that separately as `docs(architecture): ...` — this is the established pattern across all prior history in this repo.
