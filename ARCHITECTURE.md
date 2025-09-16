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

### Paso 7: CRUD para el Módulo de Subcategorías

- **Objetivo:** Construir los endpoints para gestionar las `Subcategories`, que están anidadas dentro de una `Category`. Este módulo sirve para reforzar los patrones de diseño establecidos en el CRUD de Categorías.
- **Implementación:**
  - **Estructura y DTOs:** Se sigue la misma estructura que el `CategoryModule` (Controller, Service, DTOs con `PartialType` para updates).
  - **Lógica de Autorización Anidada:** La decisión de arquitectura clave aquí es cómo se manejan los permisos. Para realizar cualquier operación sobre una `Subcategory`, el servicio primero debe:
    1.  Consultar la `Subcategory` para encontrar el `id` de su `Category` padre.
    2.  Consultar la `Category` padre para encontrar el `id` de su `Wallet`.
    3.  Ejecutar la lógica de `checkWalletMembership` con el `userId` del token y el `walletId` obtenido.
  - **Lección Aprendida:** Este flujo demuestra cómo la autorización puede propagarse a través de relaciones en el modelo de datos, asegurando que los permisos a nivel de "contenedor" (la `Wallet`) protejan todos los recursos que contiene. Se identifica la duplicación de la función `checkWalletMembership`, marcándola como candidata a ser extraída a un `PermissionsService` compartido en una futura refactorización para seguir el principio DRY (Don't Repeat Yourself).

### Paso 8: CRUD para el Módulo de Transacciones

- **Objetivo:** Implementar la funcionalidad principal de la aplicación: la creación y gestión de transacciones de ingresos y gastos.
- **Implementación:**
  - **Estructura del Módulo:** Se creó la estructura estándar de NestJS (`TransactionModule`, `Controller`, `Service`, `DTOs`).
  - **DTOs Detallados:** El `CreateTransactionDto` utiliza una variedad de validadores de `class-validator` (`@IsNumber`, `@IsPositive`, `@IsEnum`, `@IsDateString`) para garantizar la integridad de los datos de la transacción antes de que lleguen a la lógica de negocio.
  - **Lógica de Autorización Multi-Nivel:** Este servicio presenta el caso de autorización más complejo hasta ahora:
    1.  **Permiso de Cartera:** Al igual que en otros módulos, se verifica la membresía del usuario en la `Wallet` (`checkWalletMembership`).
    2.  **Permiso de Pertenencia Cruzada:** Se añade una validación crucial para la operación de `create` y `update`: el servicio comprueba que la `Subcategory` proporcionada pertenezca realmente a la `Wallet` especificada. Esto previene que un usuario pueda asignar una transacción en su cartera a una categoría de otra cartera a la que no tiene acceso, manteniendo la integridad referencial.
    3.  **Permiso de Rol:** Las operaciones de escritura (`update`, `delete`) están restringidas a usuarios con el rol `OWNER` en la cartera.
  - **Manejo de Tipos de Datos:** El servicio se encarga de transformar los datos del DTO al formato requerido por la base de datos, como convertir una `date` en formato string a un objeto `Date` de JavaScript.

### Paso 9: Endpoints del Dashboard y Datos Agregados

- **Objetivo:** Crear endpoints especializados que no devuelvan datos crudos, sino información procesada y agregada, lista para ser consumida por componentes de visualización de datos (gráficos, resúmenes) en el frontend.

#### **9.1 - Resúmenes de Cartera (`/dashboard/summary`)**

- **Requisito:** Obtener una vista rápida del estado financiero de una cartera (ingresos totales, gastos totales, balance).
- **Implementación (Prisma `aggregate`):**
  - Se implementó el método `getWalletSummary` en el `DashboardService`.
  - En lugar de traer todas las transacciones y sumarlas en JavaScript, se utiliza la función `aggregate` de Prisma. Esta delega el cálculo de la suma (`_sum`) directamente a la base de datos PostgreSQL, lo cual es significativamente más eficiente y rápido.
  - Se ejecutan dos agregaciones en paralelo (una para `INCOME`, otra para `EXPENSE`) usando `Promise.all` para optimizar el tiempo de respuesta.

#### **9.2 - Gastos por Categoría (`/dashboard/expenses-by-category`)**

- **Requisito:** Obtener los gastos totales agrupados por categoría principal para alimentar un gráfico de pastel.
- **Implementación (Prisma `groupBy` y Enriquecimiento de Datos):**
  - El servicio primero utiliza `groupBy` de Prisma para agrupar las transacciones de gastos por `subcategoryId` y sumar sus montos.
  - Como `groupBy` devuelve solo los IDs, el resultado se "enriquece" en un segundo paso: se itera sobre los grupos, se busca la información completa de cada subcategoría (incluyendo su categoría padre) y se crea un nuevo array con los nombres de las categorías.
  - Finalmente, se utiliza el método `reduce` de JavaScript para sumar los montos de diferentes subcategorías que pertenecen a la misma categoría principal (ej. sumar "Supermercado" y "Restaurante" bajo "Comida").
  - El resultado se formatea como `{ name, value }`, un formato ideal para la mayoría de las librerías de gráficos.

#### **9.3 - Filtrado Avanzado de Transacciones**

- **Requisito:** Permitir al usuario buscar y filtrar su lista de transacciones por múltiples criterios como rango de fechas o tipo.
- **Implementación:**

  - **DTO para Query Params:** Se creó un `GetTransactionsFilterDto` para validar los parámetros opcionales de la URL.
  - **Construcción Dinámica de Consultas:** El `TransactionService` fue refactorizado para construir la cláusula `where` de Prisma de forma dinámica, añadiendo condiciones solo si los filtros correspondientes son proporcionados.

  - **Mejora en el Backend:** Se extendió el endpoint `GET /transactions` para aceptar también `categoryId` y `subcategoryId` como parámetros de filtro opcionales. El `TransactionService` ahora puede filtrar transacciones por una categoría específica (incluyendo todas sus subcategorías) o por una subcategoría individual.

  #### **9.4 - (Implementado) Filtrado Avanzado de Transacciones en `TransactionModule`**

- Como parte de la base para el dashboard, se mejoró el endpoint `GET /transactions` para aceptar filtros por `startDate`, `endDate` y `type`, permitiendo al frontend solicitar los datos precisos que necesita.

---

### **Apéndice: Desafíos Enfrentados y Lecciones Aprendidas**

#### **Resolución de un Problema Persistente de "Cannot Find Module"**

Durante la creación del decorador `@CurrentUser`, nos encontramos con un error persistente `TS2307: Cannot find module` que no se solucionaba con los métodos de depuración habituales (limpieza de caché de npm, reinicio de VS Code).

- **Diagnóstico:** Se determinó que la causa raíz era una **caché corrupta del servidor de TypeScript de VS Code en el entorno WSL**. El editor no estaba reconociendo un archivo que existía físicamente en el sistema de archivos.

- **Solución en Múltiples Pasos (Proceso de "Exorcismo"):** La solución requirió un proceso de invalidación de caché a varios niveles para forzar una re-indexación completa del proyecto:

  1.  **Recreación de Archivos:** La acción más efectiva fue eliminar por completo la carpeta y el archivo del decorador y recrearlos desde cero (incluso con un nombre ligeramente diferente, ej. `decorators`). Esto obligó al sistema de archivos a generar nuevas referencias.
  2.  **Limpieza Profunda de Dependencias:** Se realizó un ciclo completo de `rm -rf node_modules`, `rm package-lock.json`, `npm cache clean`, y `npm install` para descartar cualquier corrupción en las dependencias.
  3.  **Reinicio del Entorno Completo:** Se ejecutó `wsl --shutdown` desde PowerShell para detener y reiniciar el subsistema de WSL, seguido de un reinicio de Docker Desktop.
  4.  **Ajuste Final de ESLint:** Una vez solucionado el problema de resolución, aparecieron errores de linting (`no-unsafe-assignment`, etc.) debido a reglas muy estrictas. Estos se solucionaron desactivando dichas reglas en el archivo `eslint.config.mjs`, una práctica común para adaptar el linter a la naturaleza dinámica de los decoradores de NestJS.

- **Lección Aprendida:** En entornos complejos como WSL, los problemas de caché pueden ser profundos. Cuando el código y la estructura son correctos pero los errores persisten, un "reseteo" completo del entorno, incluyendo la recreación de los archivos problemáticos, es una estrategia de depuración válida y poderosa.

---

### **Parte 2: El Frontend (Angular)**

---

### Paso 10: Inicialización y Configuración del Proyecto Angular

- **Objetivo:** Crear la base para la aplicación de frontend utilizando el Angular CLI, configurada con las mejores prácticas modernas para una aplicación de panel de control (dashboard).

- **Decisiones de Arquitectura y Configuración:**
  - **Monorepo:** El proyecto de Angular se crea en una nueva carpeta `frontend/` en la raíz del repositorio, conviviendo con la carpeta `backend/`. Esto facilita la gestión del código y el control de versiones de toda la aplicación.
  - **Angular CLI:** Se utiliza el comando `ng new` para generar la estructura del proyecto.
  - **Componentes Standalone (`--standalone`):** Se optó por la arquitectura moderna de Angular, que simplifica la estructura de la aplicación al eliminar la necesidad de `NgModule`s. Los componentes, directivas y pipes ahora gestionan sus propias dependencias, lo que reduce el código repetitivo (`boilerplate`) y mejora la optimización (`tree-shaking`).
  - **SCSS (`--style=scss`):** Se eligió SCSS como preprocesador de CSS para aprovechar características avanzadas como variables, mixins y anidación, lo que permite un código de estilos más mantenible y escalable.
  - **Renderizado del Lado del Cliente (CSR):** Se optó por una configuración de SPA (Single Page Application) tradicional. Dado que la aplicación es una herramienta privada detrás de un login, el SEO no es una prioridad, y el CSR ofrece la experiencia de usuario más fluida e interactiva una vez que la aplicación ha cargado.
  - **Pivote a 100% Angular Material:**
    - **Decisión:** Tras encontrar dificultades de configuración con Tailwind CSS en el entorno WSL, se tomó la decisión arquitectónica de pivotar a una estrategia de UI basada exclusivamente en **Angular Material**.
    - **Justificación:** Este enfoque elimina la complejidad de la configuración, garantiza una alta consistencia visual y funcional, y aprovecha el ecosistema nativo de Angular, permitiendo un desarrollo más rápido y enfocado en la lógica de negocio. La personalización del diseño se logrará a través de SCSS, modificando el tema de Material.
  - **Gestión de Módulos de Material (Patrón "Barrel"):**
    - Para evitar la importación repetitiva de módulos de Material en cada componente standalone, se ha implementado un patrón de "barrel".
    - Se creó un archivo `shared/material/material.module.ts` que no es un `NgModule`, sino un simple archivo que exporta un array constante (`MATERIAL_MODULES`) con todos los módulos de UI necesarios.
    - Los componentes que necesiten Material pueden ahora importar este array y usar el operador "spread" (`...MATERIAL_MODULES`) en su propiedad `imports`, manteniendo el código limpio, centralizado y fácil de mantener.

### Paso 11: Estructura de Rutas y Páginas de Autenticación

- **Objetivo:** Construir la arquitectura de enrutamiento para la sección de autenticación y desarrollar la estructura visual inicial de la página de Login.

- **Implementación y Decisiones Clave:**
  - **Organización de Módulos por Funcionalidad:** Se creó una carpeta `src/app/auth/` para contener todos los artefactos relacionados con la autenticación (componentes, rutas, servicios). Dentro de ella, se utiliza una subcarpeta `pages/` para diferenciar los componentes que actúan como vistas completas.
  - **Enrutamiento por Módulo (`Feature Routing`):**
    - Se creó un archivo `auth.routes.ts` que define las rutas específicas de esta funcionalidad (`login`, `register`).
    - En el archivo principal `app.routes.ts`, se utiliza **lazy loading** (`loadChildren`) para cargar estas rutas. Esta es una práctica de rendimiento crucial: el código de las páginas de autenticación solo se descarga del servidor cuando el usuario navega a `/auth`, haciendo que la carga inicial de la aplicación sea más rápida.
  - **UI del Login:**
    - Se maquetó la estructura visual de la página de Login utilizando componentes de **Angular Material** como `mat-card` y `mat-form-field`. Esto proporciona una base de UI accesible y funcional desde el principio.
    - Se aplicaron estilos básicos con **SCSS** para centrar el formulario y asegurar una presentación limpia, siguiendo el enfoque "funcionalidad primero, diseño detallado después".

### Paso 12: Conexión del Formulario de Login a la API

- **Objetivo:** Darle funcionalidad al formulario de Login, permitiendo a los usuarios autenticarse contra el backend y persistir el estado de la sesión en el navegador.

- **Implementación y Decisiones Clave:**
  - **Formularios Reactivos (`ReactiveFormsModule`):** Se eligió el enfoque de Formularios Reactivos de Angular por su robustez y facilidad para las pruebas.
    - Se creó un `FormGroup` en el `LoginComponent` utilizando `FormBuilder`.
    - Se definieron `Validators` (`required`, `email`, etc.) directamente en el componente, creando una primera capa de validación en el cliente que mejora la experiencia de usuario al dar feedback inmediato.
    - El estado del formulario se usa para deshabilitar dinámicamente el botón de envío (`[disabled]="loginForm.invalid"`), previniendo peticiones inválidas.
  - **Servicio de Abstracción de API (`AuthService`):**
    - Se creó un `AuthService` en Angular para encapsular toda la lógica de comunicación con los endpoints de autenticación.
    - Utiliza el `HttpClient` de Angular (inyectado a través de `provideHttpClient` en `app.config.ts`) para realizar las peticiones `POST`.
    - Devuelve `Observables`, siguiendo el patrón estándar de programación reactiva de Angular.
  - **Manejo del Token (JWT):**
    - El `LoginComponent` se suscribe al `Observable` del `AuthService`.
    - En caso de una respuesta exitosa, el `access_token` recibido de la API se almacena en el **`localStorage`** del navegador.
    - **Justificación de `localStorage`:** A diferencia de la base de datos (que vive en el servidor), `localStorage` es un almacenamiento persistente en el navegador del cliente. Es el lugar estándar para guardar el token JWT, permitiendo que la aplicación recuerde que el usuario está autenticado incluso si refresca la página o cierra y vuelve a abrir el navegador.

### Paso 13: Mecanismos de Sesión y Protección de Rutas (Interceptor y Guard)

- **Objetivo:** Automatizar el uso del token JWT guardado y proteger las áreas privadas de la aplicación, asegurando que solo los usuarios autenticados puedan acceder a ellas.

#### **13.1 - Interceptor HTTP para Autenticación**

- **Concepto:** Un `HttpInterceptor` en Angular es una función que se sitúa en medio de todas las peticiones HTTP salientes para modificarlas.
- **Implementación (`auth.interceptor.ts`):** Se creó un interceptor funcional que busca el `access_token` en `localStorage`. Si existe, clona la petición y le añade la cabecera `Authorization: Bearer <token>`. Se registra globalmente en `app.config.ts` para automatizar la autenticación de todas las llamadas a la API.

#### **13.2 - Route Guard para Autorización de Vistas**

- **Concepto:** Un `Guard` en el enrutador de Angular es una función que se ejecuta antes de permitir la navegación a una ruta, devolviendo `true` (permitir) o `false` (bloquear).
- **Implementación (`auth.guard.ts`):** Se creó un `CanActivateFn` que comprueba la existencia del `access_token` en `localStorage`. Si el token no existe, cancela la navegación y redirige al usuario a la página de `/auth/login`.
- **Aplicación:** El guardián se aplica a las rutas principales que necesitan protección en `app.routes.ts` utilizando la propiedad `canActivate: [authGuard]`.

#### **13.3 - Desafíos Enfrentados y Soluciones**

- **Problema de Redirección:** Se detectó un bug donde la redirección al dashboard fallaba porque el `AuthGuard` buscaba el token con una clave incorrecta en `localStorage` (`'token'` en lugar de `'access_token'`).
- **Solución:** Se estandarizó el uso de la clave `'access_token'` en toda la aplicación (tanto en el `AuthService` que lo guarda como en el `AuthGuard` que lo lee), solucionando el flujo de redirección.

### Paso 14: Construcción de la Página Principal del Dashboard

- **Objetivo:** Crear la primera vista funcional para el usuario autenticado, mostrando un resumen de su cartera y una visualización gráfica de sus gastos.

- **Implementación y Decisiones Clave:**

  - **Servicio de Datos del Dashboard:** Se creó un `DashboardService` en Angular, dedicado a comunicarse con los endpoints `/dashboard/*` del backend. Este servicio encapsula las llamadas HTTP para obtener datos agregados, como el resumen de la cartera y los gastos por categoría.
  - **Componente Contenedor (`HomeComponent`):** Este componente actúa como el "cerebro" de la página. En su `ngOnInit`, orquesta las llamadas al `DashboardService` para obtener los datos necesarios.
  - **Visualización de Datos:**
    - Los datos de resumen (ingresos, gastos, balance) se muestran en tarjetas (`mat-card`) para una lectura rápida.
    - Se utiliza el **`currency` pipe** de Angular para formatear los valores numéricos como moneda local, mejorando la presentación y la experiencia de usuario.
  - **Integración de Gráficos con `ngx-charts`:**

    - Se eligió `ngx-charts` como librería de visualización por su buena integración con Angular y su facilidad de uso.
    - Se implementó un gráfico de dona (`ngx-charts-pie-chart`) en la plantilla del `HomeComponent`.
    - La propiedad `[results]` del componente del gráfico se enlaza directamente al array de datos `expensesByCategory` que viene de la API, demostrando un flujo de datos reactivo y eficiente desde el backend hasta la UI.

    #### **14.1 - Depuración y Tipado Fuerte en Plantillas**

- **Desafío:** Durante la implementación del gráfico, surgieron errores de TypeScript en la plantilla HTML, como `Type '"below"' is not assignable to type 'LegendPosition'`.
- **Solución y Buena Práctica:** Se resolvió importando el `enum` `LegendPosition` de `@swimlane/ngx-charts` directamente en el archivo TypeScript del componente (`home.component.ts`) y creando una propiedad de clase para almacenar el valor deseado (ej. `legendPosition: LegendPosition = LegendPosition.Below;`).
- **Lección Aprendida:** Cuando se utiliza el _binding de propiedad_ (`[prop]="value"`), Angular evalúa `value` como una expresión de TypeScript. Para tipos complejos como los `enums`, la mejor práctica es manejar el valor en el TypeScript del componente y enlazar la propiedad de la plantilla a esa variable de componente. Esto aprovecha al máximo la seguridad de tipos, permite el autocompletado en el editor y mantiene la plantilla más limpia.

### Paso 15: Implementación del Layout Principal de la Aplicación

- **Objetivo:** Crear una estructura de navegación persistente (shell) para todas las vistas autenticadas, utilizando un menú lateral (sidenav) y una barra de herramientas superior (toolbar).

- **Implementación y Decisiones Clave:**
  - **Componente de Layout (`DashboardLayoutComponent`):** Se creó un componente dedicado para actuar como el "esqueleto" de la aplicación. Este componente no contiene lógica de negocio, solo la estructura visual.
  - **Uso de Componentes de `Angular Material`:**
    - `MatSidenavContainer`, `MatSidenav` y `MatSidenavContent`: Se utilizaron para crear un layout robusto de navegación lateral. El `mode="side"` asegura que el contenido principal se ajuste cuando el menú se muestra u oculta.
    - `MatToolbar`: Proporciona una barra de herramientas superior estándar. Incluye un botón que interactúa con el `MatSidenav` (`sidenav.toggle()`) para controlar su visibilidad.
    - `MatNavList` y `mat-list-item`: Se usan para crear una lista de navegación semánticamente correcta dentro del sidenav.
  - **Arquitectura de Enrutamiento Padre-Hijo:**
    - La configuración de rutas del dashboard (`dashboard.routes.ts`) se refactorizó para adoptar un patrón de anidamiento.
    - La ruta padre (`path: ''`) ahora renderiza el `DashboardLayoutComponent`.
    - Las páginas reales (como `HomeComponent`) se definen como rutas `children`. Estas se renderizan dentro del `<router-outlet>` del `DashboardLayoutComponent`.
    - **Beneficio:** Esta arquitectura asegura que el layout (header, sidenav) se renderice una sola vez y persista a través de la navegación entre las diferentes secciones del dashboard, creando una experiencia de usuario fluida y de aplicación de una sola página (SPA).
  - **Enlaces de Ruta Activos (`routerLinkActive`):** Se utiliza la directiva `routerLinkActive` en los enlaces del menú. Angular añade automáticamente una clase CSS (`active-link`) al enlace correspondiente a la ruta activa, permitiéndonos resaltar visualmente la sección actual en la que se encuentra el usuario.

### Paso 16: Implementación de la Vista de Lista de Transacciones

- **Objetivo:** Crear una vista detallada y funcional donde el usuario pueda ver todas sus transacciones, sentando las bases para la interacción principal con la aplicación.

- **Implementación y Decisiones Clave:**
  - **Componente Dedicado (`TransactionListComponent`):** Se generó un nuevo componente de página dentro del `DashboardModule` para encapsular toda la lógica y la vista de la lista de transacciones.
  - **Servicio de Datos (`TransactionService` Angular):** Se creó un servicio en una carpeta de dominio `transactions/` para manejar la comunicación con la API de transacciones del backend. Esto separa la lógica de obtención de datos de la lógica de presentación, siguiendo el principio de responsabilidad única.
  - **Indicador de Carga (Spinner Reutilizable):**
    - Se creó un `LoadingSpinnerComponent` genérico en la carpeta `shared/components`.
    - En la `TransactionListComponent`, se implementó una propiedad `isLoading` que se activa antes de la llamada a la API y se desactiva en el bloque `finalize` del observable de RxJS. Esto asegura que el spinner se oculte tanto si la petición tiene éxito como si falla.
    - La plantilla utiliza `*ngIf` para mostrar condicionalmente el spinner o la lista de resultados, mejorando la experiencia de usuario (UX) durante la carga de datos.
  - **Diseño de la Lista (Tarjeta de Transacción):**
    - **Decisión Arquitectónica:** En lugar de usar `mat-table`, que es difícil de hacer responsive, se optó por un enfoque "Mobile-First" utilizando `div`s con `display: flex`. Se abandonó el uso de `mat-list` para tener un control total y explícito sobre el layout.
    - **Maquetación:** Cada transacción se representa como una tarjeta individual con un layout horizontal claro: [Icono] [Descripción/Detalles] [Monto].
    - **Estilos Dinámicos:** Se utiliza la directiva `[ngClass]` para aplicar clases CSS condicionales, cambiando el color del icono y del monto dependiendo de si la transacción es un `INCOME` (verde) o un `EXPENSE` (rojo).
    - **Pipes de Angular:** Se usan los pipes `date` y `currency` para formatear los datos directamente en la plantilla, manteniendo la lógica de presentación fuera del componente TypeScript.
  - **Botón Flotante de Acción (FAB):** Se añadió un `mat-fab` para la acción principal de la página (añadir una nueva transacción), siguiendo las guías de diseño de Material para acciones primarias en una vista.

### Paso 17: Implementación de la Vista de Lista de Transacciones y Filtros Avanzados

- **Objetivo:** Construir la vista principal para la gestión de transacciones, mostrando una lista de movimientos y proporcionando una interfaz de usuario robusta para filtrarlos dinámicamente.

- **Implementación y Decisiones Clave:**
  - **Componente y Servicio Dedicados:** Se siguió el patrón establecido, creando un `TransactionListComponent` para la vista y un `TransactionService` en Angular para encapsular la lógica de API, manteniendo una clara separación de responsabilidades.
  - **Carga Inicial de Datos:** En el `ngOnInit`, se realiza una llamada inicial a `loadTransactions()` para poblar la vista con todos los datos disponibles tan pronto como el componente se carga, proporcionando valor inmediato al usuario.
  - **Formulario de Filtros Reactivo (`filterForm`):**
    - Se implementó un `FormGroup` para gestionar el estado de todos los controles de filtro (`type`, `startDate`, `endDate`, `categoryId`, `subcategoryId`).
    - Este enfoque centraliza el estado de los filtros y facilita la interacción con ellos de forma reactiva.
  - **Lógica de Filtros Dinámicos y Dependientes (RxJS):**
    - **Filtros Independientes:** La recarga de transacciones se dispara escuchando el `valueChanges` del `filterForm` completo. Para optimizar el rendimiento y la UX, se utilizan operadores de RxJS:
      - `debounceTime(400)`: Evita hacer llamadas a la API con cada pulsación de tecla o cambio rápido, esperando a que el usuario haga una pausa.
      - `distinctUntilChanged()`: Previene llamadas duplicadas si el valor de los filtros no ha cambiado realmente.
    - **Filtros Dependientes (Categoría -> Subcategoría):** Se implementó una lógica reactiva separada para los filtros anidados.
      - Se suscribe a los `valueChanges` del control de `categoryId`.
      - Utiliza el operador `switchMap` para cancelar peticiones anteriores y lanzar una nueva llamada al `SubcategoryService` cada vez que se selecciona una nueva categoría.
      - Esto asegura que el desplegable de subcategorías siempre muestre opciones relevantes y se actualice de forma eficiente.
  - **Manejo de Fechas (Localización vs. API):**
    - **UI:** Se configuró la localización de Angular (`LOCALE_ID`) y Angular Material (`MAT_DATE_LOCALE`) a `'es-CL'`. Esto hace que el `mat-date-range-input` muestre y acepte fechas en el formato `DD/MM/YYYY`, familiar para el usuario.
    - **Lógica de Envío:** En el componente, antes de enviar los filtros a la API, la función `formatDate` de Angular se utiliza para convertir las fechas al formato estándar ISO (`YYYY-MM-DD`), que es el que el backend espera. Esta transformación garantiza una comunicación robusta y sin ambigüedades con el servidor.

### Paso 18: Creación de Transacciones desde el Frontend

- **Objetivo:** Permitir al usuario añadir nuevas transacciones a través de una interfaz de usuario intuitiva y fluida, completando el ciclo CRUD principal de la aplicación.

- **Implementación y Decisiones Clave:**
  - **Experiencia de Usuario con Diálogo Modal (`MatDialog`):**
    - **Decisión:** En lugar de navegar a una nueva página, la creación de transacciones se maneja a través de un **diálogo modal**.
    - **Justificación:** Esta elección proporciona una UX superior, ya que el usuario no pierde el contexto de la lista de transacciones que está viendo. La acción de "añadir" se siente como una tarea rápida y superpuesta.
  - **Componente de Formulario Reutilizable (`TransactionFormComponent`):**
    - Se creó un componente dedicado exclusivamente para el formulario. Esto sigue el principio de responsabilidad única y permite que el mismo formulario pueda ser reutilizado en el futuro para una funcionalidad de "editar transacción".
  - **Paso de Datos a Diálogos (`MAT_DIALOG_DATA`):** Se utiliza el token de inyección `MAT_DIALOG_DATA` para pasar información esencial (como el `walletId` actual) desde el componente padre (`TransactionListComponent`) al componente hijo dentro del diálogo (`TransactionFormComponent`).
  - **Comunicación de Vuelta y Refresco de Datos:**
    - El `TransactionFormComponent` utiliza `MatDialogRef` para controlar su propio estado. Al guardar una transacción con éxito, llama a `dialogRef.close(true)`.
    - El `TransactionListComponent` se suscribe al evento `afterClosed()` del diálogo. Si recibe el valor `true`, interpreta que la operación fue exitosa y vuelve a llamar a su método `loadTransactions()`.
    - Este patrón de **"abrir -> actuar -> cerrar con resultado -> reaccionar"** es el estándar para manejar la comunicación y el refresco de datos con diálogos en Angular.

---

#### ** - Desafíos Enfrentados Durante la Conexión Frontend-Backend**

- **Problema 1: Error `NG01101 (Expected async validator)`:**

  - **Síntoma:** La aplicación fallaba al escribir en el campo de contraseña.
  - **Causa:** Una ambigüedad en la forma en que `FormBuilder` interpreta los arrays de validadores.
  - **Solución:** Se refactorizó la creación del `FormGroup` para usar `new FormControl()` explícitamente para cada campo. Esto elimina cualquier ambigüedad para el motor de formularios de Angular, especificando claramente que solo se están usando validadores síncronos.

- **Problema 2: Error de CORS (`HttpErrorResponse status: 0`):**

  - **Síntoma:** Las peticiones desde Angular fallaban con un error de "conexión rechazada" o "error desconocido".
  - **Causa:** La política de seguridad "Same-origin" del navegador, que impide que un origen (`http://localhost:4200`) haga peticiones a otro (`http://localhost:3000`) sin permiso explícito.
  - **Solución:** Se habilitó CORS en el backend de NestJS. En `main.ts`, se añadió `app.enableCors()`, especificando el `origin` exacto del frontend de Angular. Esto le indica al servidor que confíe y acepte las peticiones que vienen de nuestra aplicación cliente.

- **Problema 3: Error `404 Not Found` en el Login:**
  - **Síntoma:** Después de solucionar CORS, la petición de login recibía un error 404.
  - **Causa:** Una inconsistencia de nombres. El endpoint en el backend era `/auth/signin`, pero el `AuthService` de Angular estaba llamando a `/auth/login`.
  - **Solución:** Se alinearon los nombres, actualizando la ruta en el `AuthService` de Angular para que coincidiera con la ruta definida en el `AuthController` de NestJS.
