## 🏗️ Guía de Arquitectura y Construcción

Esta sección sirve como un diario de desarrollo y una guía de arquitectura detallada. Documenta las decisiones clave, la estructura y los conceptos implementados en cada paso.

### **Paso 1: Configuración del Entorno de Desarrollo con Docker**

- **Objetivo:** Crear un entorno local reproducible con Docker Compose para el backend de NestJS (`api`) y la base de datos PostgreSQL (`db`).
- **Componentes Clave:**
  - `Dockerfile`: Se utiliza un `Dockerfile` multi-etapa para construir una imagen de producción optimizada para la API. Esto reduce el tamaño final de la imagen y mejora la seguridad al no incluir dependencias de desarrollo ni el código fuente de TypeScript.
  - `docker-compose.yml`: Orquesta los servicios `api` y `db`.
    - **Comunicación:** Los servicios se comunican a través de una red bridge personalizada (`financial-tracker-net`), permitiendo que la API se conecte a la base de datos usando el nombre de servicio `db` como hostname.
    - **Persistencia de Datos:** Se utiliza un volumen nombrado de Docker (`pgdata`) para la base de datos, asegurando que los datos persistan incluso si el contenedor se detiene o se elimina.
    - **Variables de Entorno:** Se inyecta la `DATABASE_URL` en el servicio `api` para su uso en producción dentro del contenedor.
- **Comandos Esenciales:**
  - `docker-compose up -d --build`: Levanta el entorno en segundo plano y reconstruye la imagen si hay cambios.
  - `docker-compose down`: Detiene y elimina los contenedores.
  - `docker-compose logs -f api`: Muestra los logs en vivo del servicio de la API.

### Paso 2: Integración de Prisma, Migraciones y Conexión a NestJS

- **Objetivo:** Conectar la API a la base de datos, definir el modelo `User` y crear la tabla correspondiente mediante migraciones, integrando Prisma de forma robusta en NestJS.
- **Componentes Clave:**
  - **ORM:** Se eligió Prisma por su seguridad de tipos (type-safety) y su moderna API de cliente.
  - `prisma/schema.prisma`: Es la **única fuente de verdad** para el esquema de la base de datos. Se define el modelo `User` y se configura el generador de cliente para que emita los tipos en la ubicación estándar (`node_modules/@prisma/client`).
  - **Conexión Dual de `DATABASE_URL`:**
    - En `.env`: Se usa `localhost` para que los comandos del CLI de Prisma (ej. `prisma migrate`) puedan acceder a la BBDD desde la máquina host a través del puerto expuesto.
    - En `docker-compose.yml`: Se usa `db` como hostname para la comunicación interna entre contenedores en tiempo de ejecución.
  - **Migraciones:** El comando `npx prisma migrate dev` compara el `schema.prisma` con el estado de la base de datos, genera un archivo de migración SQL y lo aplica, manteniendo un historial versionado de los cambios del esquema.
  - **Integración con NestJS:** Se creó un `PrismaService` dedicado que extiende `PrismaClient` y gestiona el ciclo de vida de la conexión (`$connect` en `onModuleInit`). Este servicio se hace disponible para inyección de dependencias en toda la aplicación a través de un `PrismaModule` exportado.

## 🛠️ Cómo Empezar (Setup Local)

1. Clona el repositorio: `git clone ...`
2. ...
