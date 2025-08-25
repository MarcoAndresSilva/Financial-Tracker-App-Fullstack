# 🏗️ Guía de Arquitectura y Construcción

Esta sección sirve como un diario de desarrollo y una guía de arquitectura detallada para el proyecto "Financial Tracker App". Documenta las decisiones clave, la estructura y los conceptos implementados en cada paso.

### **Paso 1: Configuración del Entorno de Desarrollo con Docker**

- **Objetivo:** Crear un entorno local reproducible con Docker Compose para el backend de NestJS (`api`) y la base de datos PostgreSQL (`db`).
- **Componentes Clave:**
  - `Dockerfile`: Se utiliza un `Dockerfile` multi-etapa para construir una imagen de producción optimizada.
    - **Flujo de Build con Prisma:** Es crucial que el script `build` en `package.json` ejecute `prisma generate` _antes_ de `nest build`. Además, la etapa final `production` del Dockerfile debe copiar la carpeta `node_modules` desde la etapa `build` (no desde la de `dependencies`) para asegurar que el cliente de Prisma ya generado se incluya en la imagen final. Esto previene errores de inicialización de Prisma en tiempo de ejecución.
  - `docker-compose.yml`: Orquesta los servicios `api` y `db`.
    - **Comunicación:** Los servicios se comunican a través de una red bridge personalizada, permitiendo que la API se conecte a la base de datos usando el nombre de servicio `db` como hostname.
    - **Persistencia de Datos:** Se utiliza un volumen nombrado de Docker (`pgdata`) para asegurar que los datos persistan.
    - **Variables de Entorno:** Se utiliza la directiva `env_file` para inyectar variables (como `JWT_SECRET`) desde un archivo `.env` al contenedor, y la directiva `environment` para definir o sobrescribir variables específicas del entorno Docker (como `DATABASE_URL`).

### **Paso 2: Integración de Prisma, Migraciones y Conexión a NestJS**

- **Objetivo:** Conectar la API a la base de datos, definir el modelo `User` inicial y crear la tabla correspondiente mediante migraciones, integrando Prisma de forma robusta en NestJS.
- **Componentes Clave:**
  - **ORM:** Se eligió Prisma por su seguridad de tipos (type-safety) y su moderna API de cliente.
  - `prisma/schema.prisma`: Es la **única fuente de verdad** para el esquema de la base de datos.
  - **Migraciones:** El comando `npx prisma migrate dev` genera y aplica migraciones SQL, manteniendo un historial versionado de los cambios del esquema.
  - **Integración con NestJS:** Se creó un `PrismaService` y `PrismaModule` dedicados para encapsular la lógica de conexión a la base de datos y hacerla disponible para inyección de dependencias en toda la aplicación.

### **Paso 3: Módulo de Autenticación (Registro y Login con JWT)**

- **Objetivo:** Implementar un flujo de autenticación completo, permitiendo a los usuarios registrarse, iniciar sesión y recibir un `access_token` (JWT) para futuras peticiones.
- **Flujo de `signin` y `signup`:** Se implementaron los endpoints `POST /auth/signup` y `POST /auth/signin` siguiendo el patrón de NestJS: `Controller` -> `Service` -> `DTO`. Se utiliza `bcrypt` para el hasheo y comparación de contraseñas, y `JwtService` para la generación de tokens.
- **Decisiones de Arquitectura Clave:**
  - **Carga Asíncrona de Módulos (Patrón Profesional):** Para evitar "race conditions" con las variables de entorno, el `JwtModule` se registra de forma asíncrona (`registerAsync`) en el `AuthModule`. Se utiliza una `useFactory` que depende del `ConfigService` para garantizar que el `JWT_SECRET` se lee solo después de que ha sido cargado por el `ConfigModule`.

### **Paso 4: Protección de Rutas con Estrategia JWT y Guards**

- **Objetivo:** Utilizar el `access_token` para proteger rutas, implementando un endpoint de ejemplo `GET /users/me`.
- **Componentes Clave y Conceptos:**
  - **La Estrategia de Passport (`JwtStrategy`):** Una clase que encapsula la lógica para validar un JWT. Extrae el token de la cabecera `Authorization`, verifica su firma y valida el payload (ej. comprobando que el usuario todavía existe en la BBDD). El valor que retorna el método `validate` es inyectado por NestJS en `req.user`.
  - **El Guardián (`@UseGuards(AuthGuard('jwt'))`):** Un decorador de NestJS que intercepta las peticiones y ejecuta la estrategia de autenticación especificada. Si la estrategia tiene éxito, permite el paso; si no, devuelve un error `401 Unauthorized`.
  - **Decorador Personalizado (`@GetUser`):** Para evitar la dependencia de Express (`@Req`) y mejorar la legibilidad, se creó un decorador personalizado. Este encapsula la lógica de `request.user`, permitiendo inyectar directamente el objeto de usuario (`@GetUser() user: User`) o una de sus propiedades (`@GetUser('email') email: string`) en los controladores de forma type-safe.

### **Paso 5: Diseño del Esquema de Datos Multi-Cartera**

- **Objetivo:** Evolucionar el modelo de datos de un sistema de finanzas personales a uno que soporte múltiples carteras (`Wallets`) por usuario, permitiendo espacios de trabajo tanto privados como compartidos.
- **Modelo de Datos Implementado:**
  - **`Wallet`:** El núcleo del sistema. Puede ser de tipo `PERSONAL` o `SHARED`.
  - **`User` y `WalletMembership`:** Se implementa una relación **muchos-a-muchos** entre `User` y `Wallet` a través de una tabla intermedia `WalletMembership`. Esto permite que un usuario pertenezca a múltiples carteras y que una cartera tenga múltiples miembros, con roles definidos (`OWNER`, `MEMBER`).
  - **`Category` y `Subcategory`:** Ahora están vinculadas directamente a una `Wallet`. Esto permite que cada cartera (personal o compartida) tenga su propio conjunto de categorías personalizables.
  - **`Transaction`:** El registro de movimiento. Cada transacción está ligada a una `Wallet`, una `Subcategory`, y un `User` (el autor).
- **Lógica de Registro Actualizada (`signup`):**
  - **Requisito:** Al registrarse, un usuario debe obtener automáticamente una cartera personal. Esta operación debe ser "todo o nada" para evitar datos inconsistentes.
  - **Implementación con Transacciones Anidadas de Prisma:** La solución se implementó usando una **escritura anidada (nested write)**. Dentro de una única operación `prisma.user.create`, se anidan las instrucciones para crear también la `WalletMembership` y la `Wallet` personal.
  - **Atomicidad y `ROLLBACK` (La "Pepita de Oro"):** Prisma convierte esta operación anidada en una **transacción de base de datos** real. Si alguna de las sub-operaciones falla, toda la transacción se revierte automáticamente (**`ROLLBACK`**). Esto garantiza la integridad de los datos sin necesidad de gestionar transacciones manualmente.
  - **Respuesta Enriquecida con `include`:** Se utiliza la opción `include` para que la respuesta de la creación devuelva no solo el `User`, sino también los datos relacionados de la `WalletMembership` y la `Wallet` que se crearon en la misma transacción.

### Paso 6: CRUD para el Módulo de Categorías

- **Objetivo:** Construir los endpoints para que un usuario autenticado pueda Crear, Leer, Actualizar y Borrar (CRUD) las categorías dentro de una de sus carteras (`Wallets`).

- **Implementación:**
  - **Estructura del Módulo:** Se generó la estructura estándar de NestJS con `CategoryModule`, `CategoryController` y `CategoryService`.
  - **DTOs (Contratos de Datos):**
    - `CreateCategoryDto`: Define los campos necesarios (`name`, `walletId`) para crear una categoría, con validadores de `class-validator` como `@IsUUID`.
    - `UpdateCategoryDto`: Utiliza `PartialType` de `@nestjs/mapped-types` para crear un DTO donde todos los campos son opcionales, ideal para operaciones de actualización parcial (`PATCH`).
  - **Protección de Rutas:** El `CategoryController` completo está protegido a nivel de clase con `@UseGuards(AuthGuard('jwt'))`, garantizando que ningún usuario no autenticado pueda acceder.
  - **Lógica de Autorización (El Cerebro en el Servicio):**
    - El `CategoryService` es responsable no solo de la lógica de negocio (interactuar con Prisma), sino también de la **autorización** (¿tiene este usuario permiso para hacer esto?).
    - Se creó una función auxiliar privada `checkWalletMembership(userId, walletId, ownerRequired)`. Este método reutilizable es el núcleo de la seguridad del módulo:
      1.  Verifica que el usuario (`userId` del token) es miembro de la cartera (`walletId`).
      2.  Opcionalmente, verifica si el rol de membresía es `OWNER` para acciones destructivas como actualizar o eliminar.
    - Esto asegura que un usuario no pueda ver, crear o modificar categorías en carteras a las que no pertenece.
  - **Pipes de Validación de Parámetros:** En el controlador, se utiliza `ParseUUIDPipe` en los parámetros de ruta (`@Param`) y de query (`@Query`) para validar que los IDs tengan el formato correcto antes de que lleguen al servicio, previniendo errores de base de datos y mejorando la seguridad.
