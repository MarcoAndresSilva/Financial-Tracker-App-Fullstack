# Financial Tracker App - Full Stack

![Project Banner](URL_DEL_BANNER_AQUI) <!-- Opcional: Puedes crear un banner bonito más adelante -->

Una aplicación full stack moderna para el seguimiento de finanzas personales, construida con NestJS, Angular, PostgreSQL y Docker.

## 🚀 Demo en Vivo

**[Enlace a la aplicación desplegada]** (Próximamente)

---

## ✨ Funcionalidades Clave

- [ ] **Autenticación de Usuarios:** Registro y Login seguros con JWT.
- [ ] **CRUD de Transacciones:** Gestión completa de ingresos y gastos.
- [ ] **Categorías Personalizables:** Los usuarios pueden crear y asignar sus propias categorías.
- [ ] **Dashboard Interactivo:** Visualización de datos con gráficos para un análisis financiero rápido.
- [ ] **Filtrado y Búsqueda Avanzada:** Encuentra transacciones fácilmente por fecha, tipo o categoría.

---

## 🛠️ Stack Tecnológico

| Área         | Tecnología                                                          |
| ------------ | ------------------------------------------------------------------- |
| **Backend**  | NestJS, Prisma, PostgreSQL, Passport.js (JWT)                       |
| **Frontend** | Angular (Standalone Components), Angular Material, SCSS, ngx-charts |
| **DevOps**   | Docker, Docker Compose, GitHub Actions (CI/CD)                      |

---

## 🏗️ Documentación de Arquitectura

Para una explicación detallada del proceso de construcción, las decisiones técnicas y la estructura del proyecto, consulta nuestra **[Guía de Arquitectura y Construcción](./ARCHITECTURE.md)**.

---

## local-dev-setup Cómo Empezar (Setup Local)

### Prerrequisitos

- [Node.js](https://nodejs.org/) (v18 o superior)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Instalación

1.  **Clona el repositorio:**

    ```bash
    git clone https://github.com/tu-usuario/Financial-Tracker-App-Fullstack.git
    cd Financial-Tracker-App-Fullstack
    ```

2.  **Crea el archivo de entorno del backend:**

    - Navega a la carpeta `backend`.
    - Copia ` .env.example` a `.env` (crearemos este archivo más adelante).
    - Asegúrate de que la `DATABASE_URL` esté configurada para el desarrollo local.

3.  **Levanta los contenedores:**
    Desde la raíz del proyecto, ejecuta:

    ```bash
    docker-compose up -d --build
    ```

4.  **Instala las dependencias del frontend:**
    (Próximamente, cuando iniciemos el proyecto de Angular)

La API estará disponible en `http://localhost:3000`.
