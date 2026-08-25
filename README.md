# 💰 FinTrack — Financial Tracker App

Aplicación full stack de finanzas personales pensada para usarse **en pareja**: carteras personales y compartidas, categorías propias, metas de ahorro y un dashboard que separa claramente "este mes" de "histórico". Instalable como PWA en el celular.

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Angular](https://img.shields.io/badge/Angular-19-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

---

## 🚀 Demo en Vivo

- **Frontend (Netlify):** [financialtrackapp.netlify.app](https://financialtrackapp.netlify.app)
- **Backend (Render):** `https://fintrack-backend-2dnh.onrender.com`

> El backend está alojado en el plan gratuito de Render, así que la primera petición tras un período de inactividad puede tardar unos segundos en despertar el servicio (cold start).

---

## ✨ Funcionalidades

- **Autenticación con JWT:** registro y login seguros (`bcrypt` + `passport-jwt`), con cierre de sesión automático tanto al expirar el token como por inactividad (5 min sin interacción).
- **Carteras (Wallets) personales y compartidas:** cada usuario recibe una wallet personal al registrarse; se pueden crear wallets compartidas invitando a otro usuario por email, con la opción de copiar la estructura de categorías desde una wallet existente.
- **Categorías y subcategorías personalizables:** CRUD completo por wallet, con borrado protegido si ya tienen transacciones asociadas.
- **Transacciones de ingresos y gastos:** CRUD completo con filtros por rango de fechas, tipo, categoría y subcategoría.
- **Dashboard con alcance temporal explícito:**
  - Sección **"Este mes"**: ingresos/gastos/balance del mes en curso + un indicador de ánimo (🙂😐🙁😡) según el porcentaje de ingresos gastado.
  - Sección **"Histórico"**: totales de toda la vida de la wallet, con aviso simple para invertir saldo ocioso.
  - Gráficos de barras horizontales rankeados de gastos por categoría e ingresos por subcategoría.
- **Metas de ahorro:** objetivo + aportes manuales, con barra de progreso.
- **Multi-wallet fluido:** selector de cartera activa en el toolbar; toda la app (dashboard, transacciones, categorías, metas) reacciona automáticamente al cambio.
- **PWA instalable:** manifest, ícono de marca y service worker, lista para "Agregar a pantalla de inicio" en el celular.
- **Diseño responsive mobile-first:** sidenav adaptable, filtros colapsables y layout probado en viewport de celular real.

---

## 🛠️ Stack Tecnológico

| Área         | Tecnología                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| **Backend**  | NestJS 11, Prisma 6, PostgreSQL, Passport.js (JWT), class-validator          |
| **Frontend** | Angular 19 (Standalone Components), RxJS, Angular Material (theming M3), SCSS |
| **DevOps**   | Docker, Docker Compose, despliegue en Render (API) y Netlify (frontend)     |

---

## 🏗️ Documentación de Arquitectura

Todo el proceso de construcción está documentado paso a paso —decisiones técnicas, alternativas descartadas y por qué— en **[ARCHITECTURE.md](./ARCHITECTURE.md)**. Es el diario de desarrollo completo del proyecto y la fuente de verdad sobre el estado actual.

---

## 📂 Estructura del Proyecto

```
Financial-Tracker-App-Fullstack/
├── backend/          # API NestJS + Prisma
│   ├── prisma/        # schema.prisma y migraciones
│   └── src/            # auth, user, wallet, category, subcategory,
│                        # transaction, dashboard, savings-goal,
│                        # common/permissions (autorización compartida)
├── frontend/         # Angular 19 (standalone)
│   └── src/app/
│       ├── auth/         # login / registro
│       ├── core/         # guards, interceptors, WalletContextService
│       ├── dashboard/     # layout + páginas (home, transacciones, ...)
│       └── shared/        # componentes y diálogos reutilizables
└── docker-compose.yml
```

---

## 🖥️ Cómo Empezar (Setup Local)

### Prerrequisitos

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para levantar la base de datos, o toda la app)

### Opción A — Todo con Docker Compose

1. **Clona el repositorio:**

   ```bash
   git clone https://github.com/MarcoAndresSilva/Financial-Tracker-App-Fullstack.git
   cd Financial-Tracker-App-Fullstack
   ```

2. **Configura las variables de entorno del backend:**

   ```bash
   cp backend/.env.example backend/.env
   ```

   Ajusta `DATABASE_URL` y `JWT_SECRET` según tu entorno.

3. **Levanta los contenedores** (API + PostgreSQL):

   ```bash
   docker-compose up -d --build
   ```

   La API queda disponible en `http://localhost:3000`.

4. **Instala y corre el frontend:**

   ```bash
   cd frontend
   npm install
   npm start
   ```

   La app queda disponible en `http://localhost:4200`.

### Opción B — Backend sin Docker

```bash
cd backend
npm install
cp .env.example .env   # con una DATABASE_URL apuntando a tu Postgres local
npx prisma migrate dev
npm run start:dev
```

---

## 🔑 Variables de Entorno

**`backend/.env`**

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydatabase?schema=public"
JWT_SECRET="una-clave-secreta-larga-y-aleatoria"
FRONTEND_URL="http://localhost:4200"   # opcional, para CORS en producción
```

**`frontend/src/environments/environment.ts`** — URL de la API para desarrollo local (ya configurado en el repo, apunta a `http://localhost:3000`).

---

## 🔒 Autenticación

La API usa JWT sin refresh token (expiración de 60 minutos). Las únicas rutas públicas son:

```
POST /auth/signup
POST /auth/signin
```

Todo el resto de los endpoints requiere el header `Authorization: Bearer <token>`.

---

## 🧪 Tests

```bash
# Backend
cd backend
npm test           # unit tests (Jest)
npm run test:e2e   # e2e

# Frontend
cd frontend
npm test           # Karma/Jasmine
```
