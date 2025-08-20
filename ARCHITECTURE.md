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

- **Objetivo:** Conectar la API a la base de datos, definir el modelo `User` y crear la tabla correspondiente mediante migraciones, integrando Prisma de forma robusta en NestJS.
- **Componentes Clave:**
  - **ORM:** Se eligió Prisma por su seguridad de tipos (type-safety) y su moderna API de cliente.
  - `prisma/schema.prisma`: Es la **única fuente de verdad** para el esquema de la base de datos.
  - **Migraciones:** El comando `npx prisma migrate dev` genera y aplica migraciones SQL, manteniendo un historial versionado de los cambios del esquema.
  - **Integración con NestJS:** Se creó un `PrismaService` y `PrismaModule` dedicados para encapsular la lógica de conexión a la base de datos y hacerla disponible para inyección de dependencias en toda la aplicación.

### **Paso 3: Módulo de Autenticación (Registro y Login con JWT)**

- **Objetivo:** Implementar un flujo de autenticación completo, permitiendo a los usuarios registrarse, iniciar sesión y recibir un `access_token` (JWT) para futuras peticiones.

#### **3.1 - Registro (Sign Up)**

- **Flujo de la Petición:**
  1.  **`main.ts` (Habilitador Global):** Se configura un `ValidationPipe` global para validar automáticamente todos los DTOs entrantes.
  2.  **`auth.controller.ts` (Portero):** Define la ruta `POST /auth/signup` y utiliza `@Body()` para validar la petición contra el `SignUpDto`.
  3.  **`dto/signup.dto.ts` (Contrato):** Define la "forma" de los datos de registro usando decoradores de `class-validator`.
  4.  **`auth.service.ts` (Cerebro):**
      - Hashea la contraseña con `bcrypt`.
      - Crea el usuario en la base de datos usando `PrismaService`.
      - Maneja errores de email duplicado.
      - Elimina el hash de la contraseña de la respuesta.

#### **3.2 - Login (Sign In) y Generación de JWT**

- **Flujo de la Petición:**
  1.  **`auth.controller.ts`:** Recibe la petición en `POST /auth/signin` con el `SignInDto`.
  2.  **`auth.service.ts`:**
      - Busca al usuario por email.
      - Compara la contraseña del DTO con el hash de la BBDD usando `bcrypt.compare()`.
      - Si las credenciales son válidas, llama a una función `signToken()`.
  3.  **`signToken()`:**
      - Crea un `payload` con el ID y email del usuario.
      - Usa el `JwtService` inyectado para firmar el payload y crear el `access_token`.
      - Devuelve el token al cliente.

#### **3.3 - Decisiones de Arquitectura Clave en Autenticación**

- **`auth.module.ts` (El Organizador):** Este módulo debe _importar_ los módulos de los que dependen sus servicios. Como `AuthService` usa `PrismaService` y `JwtService`, el `AuthModule` importa `PrismaModule` y configura el `JwtModule`.

- **Carga Asíncrona de Módulos (Patrón Profesional):**
  Para evitar "race conditions" donde un módulo intenta usar una variable de entorno antes de que `ConfigModule` la haya cargado, se utiliza el patrón `registerAsync`. En nuestro `AuthModule`, el `JwtModule` se registra de forma asíncrona, declarando una dependencia del `ConfigService` y usando una `useFactory` para leer el `JWT_SECRET` solo cuando este servicio está disponible. Esto garantiza una inicialización robusta y en el orden correcto.

### Paso 4: Protección de Rutas con Estrategia JWT y Guards

- **Objetivo:** Utilizar el `access_token` generado en el login para proteger rutas, asegurando que solo usuarios autenticados puedan acceder a ciertos recursos. Se implementará un endpoint `GET /users/me` como ejemplo.

- **Componentes Clave y Conceptos:**

  1.  **La Estrategia de Passport (`strategy/jwt.strategy.ts`):**

      - **Concepto:** Una "Estrategia" en Passport.js es una clase modular que encapsula toda la lógica para un método de autenticación específico (ej. JWT, OAuth, etc.).
      - **Implementación:**
        - `extends PassportStrategy(Strategy, 'jwt')`: Nuestra clase hereda de `PassportStrategy`. El primer argumento `Strategy` es la implementación base de `passport-jwt`. El segundo, `'jwt'`, es un identificador por defecto.
        - `constructor(...)` y `super({...})`:
          - **¿Qué es `super()`?**: En la programación orientada a objetos, `super()` es una llamada al constructor de la clase padre (en este caso, `PassportStrategy`). Es necesario para inicializar correctamente la estrategia base.
          - Le pasamos un objeto de configuración que le dice a la estrategia:
            - `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()`: Cómo encontrar el token. Le indicamos que lo extraiga de la cabecera `Authorization` como un "Bearer Token", que es el estándar (`Authorization: Bearer <token>`).
            - `secretOrKey`: Qué secreto usar para verificar la firma del token y asegurar que no ha sido alterado.
        - `async validate(payload)`:
          - **Rol:** Este método es el corazón de la estrategia. Passport solo lo llama **después** de haber verificado exitosamente la firma y la expiración del token. Su trabajo es tomar el `payload` (los datos que pusimos dentro del token, como el ID de usuario) y realizar una validación adicional si es necesario.
          - **Nuestra Lógica:** Usamos el `payload.sub` (el ID del usuario) para buscarlo en la base de datos. Esto asegura que el usuario del token todavía existe en nuestro sistema.
          - **El "Retorno Mágico":** El valor que esta función `validate` retorna es lo que NestJS **adjuntará al objeto `request` como `req.user`**. Este es un mecanismo clave que nos permite acceder a los datos del usuario autenticado en cualquier controlador protegido.

  2.  **El Guardián (`@UseGuards`):**

      - **Concepto:** Un "Guard" en NestJS es una clase que implementa la interfaz `CanActivate`. Su única responsabilidad es decidir si una petición puede continuar o no, devolviendo `true` o `false`. Son ideales para la autorización y autenticación.
      - **Implementación:**
        - `@UseGuards(AuthGuard('jwt'))`: En lugar de crear nuestro propio Guard desde cero, usamos el `AuthGuard` que viene con `@nestjs/passport`. Este es un Guard genérico que funciona con las estrategias de Passport.
        - Al pasarle `'jwt'`, le estamos diciendo: "Usa la estrategia que registramos con el identificador 'jwt'".
        - El `AuthGuard` se encarga de orquestar todo el flujo: invoca la estrategia, maneja los errores y, si la estrategia tiene éxito, permite que la petición continúe hacia el controlador.

  3.  **El Controlador Protegido (`user/user.controller.ts`):**
      - Aplicamos `@UseGuards(AuthGuard('jwt'))` a nivel de controlador para proteger todas sus rutas.
      - En el método `getMe`, usamos el decorador `@Req()` para inyectar el objeto `request` completo de Express.
      - Gracias a nuestra estrategia, ahora podemos acceder a `req.user` para obtener la información del usuario que fue validado por el token.
