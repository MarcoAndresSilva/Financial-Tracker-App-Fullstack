## 🏗️ Guía de Arquitectura y Construcción

Esta sección sirve como un diario de desarrollo y una guía de arquitectura detallada. Documenta las decisiones clave, la estructura y los conceptos implementados en cada paso.

### **Paso 1: Configuración del Entorno de Desarrollo con Docker**

- **Objetivo:** Crear un entorno local reproducible con Docker Compose para el backend de NestJS (`api`) y la base de datos PostgreSQL (`db`).
- **Componentes Clave:**
  - `Dockerfile`: Se utiliza un `Dockerfile` multi-etapa para construir una imagen de producción optimizada [...].
    - **Flujo de Build con Prisma:** Es crucial que el script `build` en `package.json` ejecute `prisma generate` _antes_ de `nest build`. Además, la etapa final `production` del Dockerfile debe copiar la carpeta `node_modules` desde la etapa `build` (no desde la de `dependencies`) para asegurar que el cliente de Prisma ya generado se incluya en la imagen final. Esto previene errores de inicialización de Prisma en tiempo de ejecución.
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

### Paso 3: Módulo de Autenticación - Registro (Sign Up)

- **Objetivo:** Crear un endpoint seguro para que los nuevos usuarios puedan registrarse en la aplicación.

- **Componentes Clave y Flujo de la Petición:**
  La arquitectura de NestJS para este endpoint sigue un patrón claro de separación de responsabilidades:

  1.  **`auth.module.ts` - El Organizador:** Además de declarar el controlador y el proveedor, este módulo debe _importar_ los módulos de los que dependen sus servicios. En este caso, como `AuthService` usa `PrismaService`, el `AuthModule` debe importar `PrismaModule`.

  2.  **`main.ts` - El Habilitador Global:**

      - Se configura un `ValidationPipe` de forma global (`app.useGlobalPipes`). Esto actúa como un middleware que interceptará todas las peticiones entrantes. Su trabajo es buscar DTOs en los controladores y aplicar las reglas de validación automáticamente.

  3.  **`auth.controller.ts` - El Portero (Gatekeeper):**

      - Define la ruta `POST /auth/signup`.
      - Su única responsabilidad es recibir la petición HTTP.
      - Utiliza el decorador `@Body()` para indicarle al `ValidationPipe` que el cuerpo de la petición debe ser validado contra la clase `SignUpDto`. Si la validación falla, el controlador nunca se ejecuta y se devuelve un error 400. Si tiene éxito, pasa el DTO validado al servicio.

  4.  **`dto/signup.dto.ts` - El Contrato:**

      - Esta clase actúa como un **Contrato de Transferencia de Datos (Data Transfer Object)**. Define la "forma" exacta de los datos que el endpoint espera.
      - Utiliza decoradores de `class-validator` (`@IsEmail`, `@MinLength`, etc.) para declarar las reglas de negocio. Esto mantiene la lógica de validación limpia y declarativa.

  5.  **`auth.service.ts` - El Cerebro (Business Logic):**
      - Recibe el DTO ya limpio y validado del controlador.
      - Aquí reside la lógica de negocio real:
        - **Seguridad:** Hashea la contraseña en texto plano usando `bcrypt` para nunca almacenarla directamente.
        - **Persistencia:** Se comunica con la base de datos a través del `PrismaService` inyectado para crear el nuevo usuario.
        - **Manejo de Errores:** Captura errores específicos de la base de datos (como el código `P2002` de Prisma para emails duplicados) y los traduce a excepciones HTTP claras (`ForbiddenException`).
        - **Transformación de Respuesta:** Elimina el hash de la contraseña del objeto de usuario antes de devolverlo al controlador, asegurando que los datos sensibles nunca se expongan al cliente.

## 🛠️ Cómo Empezar (Setup Local)

1. Clona el repositorio: `git clone ...`
2. ...
