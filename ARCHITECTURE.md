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

### Paso 19: Edición de Transacciones y Reutilización de Componentes

- **Objetivo:** Implementar la funcionalidad para que los usuarios puedan editar una transacción existente, reutilizando el formulario de creación para seguir el principio DRY (Don't Repeat Yourself).

- **Implementación y Decisiones Clave:**
  - **Componente de Formulario "Inteligente" (`TransactionFormComponent`):**
    - Se refactorizó el componente para que pudiera operar en dos modos: "Crear" y "Editar".
    - Se añadió una propiedad `isEditMode` (booleano) que se determina en el `constructor` al verificar si se han recibido datos de una transacción a través del `MAT_DIALOG_DATA`.
    - **En modo "Editar" (`ngOnInit`):** El componente utiliza `form.patchValue()` para rellenar los campos del formulario con los datos de la transacción existente. Se implementó lógica adicional para manejar los `selects` dependientes (categoría -> subcategoría), asegurando que se carguen las opciones correctas y se preseleccione el valor adecuado.
  - **Lógica de Guardado Condicional:** El método `onSave()` ahora contiene una bifurcación `if (this.isEditMode)`. Dependiendo del modo, llama al método `updateTransaction()` o `createTransaction()` del servicio de Angular, enviando una petición `PATCH` o `POST` respectivamente.
  - **Reutilización y Eficiencia:** Este patrón de crear un componente de formulario único para las operaciones de Crear y Editar es una práctica estándar muy potente. Reduce drásticamente la duplicación de código (HTML, SCSS y TypeScript), facilita el mantenimiento y asegura una experiencia de usuario consistente.
  - **Flujo de Datos:** El `TransactionListComponent` es responsable de abrir el diálogo. Para editar, pasa el objeto de la transacción completa al `data` del diálogo. Para crear, solo pasa el `walletId`.

### Paso 20: Refactorización a Tipado Fuerte (Eliminación de `any`)

- **Objetivo:** Mejorar la calidad y robustez del código del frontend eliminando el uso del tipo `any` y reemplazándolo con interfaces explícitas, siguiendo las mejores prácticas de TypeScript.
- **Implementación y Decisión de Arquitectura:**
  - **Justificación:** El uso de `any` desactiva las comprobaciones de tipo de TypeScript, lo que puede llevar a errores en tiempo de ejecución y reduce la eficacia de herramientas como el autocompletado. Refactorizar a un tipado fuerte es un paso crucial para asegurar la mantenibilidad a largo plazo de la aplicación.
  - **Interfaz `Transaction`:** Se definió una interfaz `Transaction` detallada en un archivo `transaction.types.ts`. Esta interfaz modela con precisión la estructura de los datos devueltos por la API del backend, incluyendo las relaciones anidadas (`subcategory`, `category`).
  - **Aplicación a Través de las Capas:**
    - **Servicio (`TransactionService`):** Se actualizaron las firmas de todos los métodos para que los `Observables` devuelvan los tipos correctos (ej. `Observable<Transaction[]>` en lugar de `Observable<any[]>`).
    - **Componente (`TransactionListComponent`):** La propiedad que almacena la lista de transacciones se tipó como `Transaction[]`.
  - **Beneficios Obtenidos:**
    - **Seguridad Estática:** El compilador de TypeScript ahora puede detectar errores de tipeo (ej. acceder a una propiedad inexistente) durante el desarrollo, antes de que el código llegue al navegador.
    - **Mejora de la Experiencia de Desarrollo (DX):** El editor de código ahora proporciona autocompletado (IntelliSense) preciso para los objetos de transacción, tanto en los archivos TypeScript como en las plantillas HTML, acelerando el desarrollo y reduciendo errores.

### Paso 21: Eliminación de Transacciones con Diálogo de Confirmación

- **Objetivo:** Completar el ciclo CRUD permitiendo a los usuarios eliminar transacciones de forma segura.
- **Implementación y Decisión de UX:**
  - **Prevención de Errores de Usuario:** Para evitar eliminaciones accidentales, una acción destructiva por naturaleza, no se elimina la transacción directamente. En su lugar, se implementó un **diálogo de confirmación** modal.
  - **Componente de Confirmación Reutilizable (`ConfirmDialogComponent`):**
    - Se creó un componente genérico y reutilizable para las confirmaciones. Recibe un `title` y un `message` a través de `MAT_DIALOG_DATA`, lo que permite usarlo para confirmar cualquier acción en el futuro (ej. "¿Eliminar categoría?", "¿Salir sin guardar?").
    - Los botones del diálogo devuelven un valor booleano a través de `mat-dialog-close`, comunicando la decisión del usuario de vuelta al componente que lo abrió.
  - **Flujo de Eliminación Reactivo:**
    - El `TransactionListComponent` abre el `ConfirmDialogComponent`.
    - Se suscribe al `afterClosed()` del diálogo.
    - Utiliza el operador `filter(result => result === true)` de RxJS para ejecutar la lógica de eliminación **solo si** el usuario confirmó la acción.
    - Tras una llamada exitosa al `deleteTransaction` del servicio, se vuelve a llamar a `loadTransactions()` para refrescar la UI, manteniendo la consistencia de los datos mostrados.

### Paso 22: Gestión de Estado Central con un `WalletContextService`

- **Objetivo:** Eliminar los `walletId` hardcodeados y crear un sistema centralizado y reactivo para gestionar la cartera activa del usuario.

- **Decisión de Arquitectura: Servicio de Estado con `BehaviorSubject`:**
  - En lugar de usar una librería de gestión de estado compleja (como NgRx o Redux), se optó por un enfoque más simple y nativo de Angular/RxJS para este caso de uso.
  - Se creó un `WalletContextService` que actúa como la **única fuente de verdad** para la cartera activa.
- **Implementación:**
  - **`BehaviorSubject` (`activeWallet$`):** El servicio utiliza un `BehaviorSubject` de RxJS para almacenar y emitir la cartera activa. `BehaviorSubject` es ideal porque guarda el último valor emitido y se lo entrega inmediatamente a cualquier nuevo suscriptor.
  - **Flujo de Inicialización:**
    1.  Después de un login exitoso, el `LoginComponent` llama a `walletContext.loadUserWallets()`.
    2.  Este método utiliza un `UserService` para llamar a `GET /users/me` y obtener todas las carteras del usuario.
    3.  La primera cartera de la lista se establece como la activa por defecto emitiendo un valor a través del `BehaviorSubject` (`.next()`).
  - **Consumo Reactivo en Componentes:**
    - Componentes como `HomeComponent` y `TransactionListComponent` fueron refactorizados para **suscribirse** al `activeWallet$` del servicio.
    - Cada vez que se emite una nueva cartera activa, la lógica dentro de la suscripción se dispara automáticamente, volviendo a cargar los datos (resúmenes, transacciones, etc.) correspondientes a la nueva cartera.
- **Beneficio:** Este patrón desacopla los componentes entre sí. Ningún componente necesita saber "quién" cambió la cartera; solo necesitan "reaccionar" al cambio emitido por el servicio central. Esto hace que la aplicación sea increíblemente escalable y fácil de mantener.

### Paso 23: Integración del `WalletContextService` en los Componentes

- **Objetivo:** Refactorizar los componentes de página (`HomeComponent`, `TransactionListComponent`) para que consuman el estado de la cartera activa desde el `WalletContextService`, eliminando los IDs hardcodeados y haciendo la aplicación completamente dinámica.

- **Implementación y Patrón Reactivo:**
  - **Suscripción al Estado Central:** En el `ngOnInit` de cada componente, se establece una suscripción al `Observable` `walletContext.activeWallet$`.
  - **Reacción a los Cambios:** Dentro de la suscripción, se implementó la lógica para que, en cuanto se reciba un objeto `Wallet` válido, se disparen los métodos de carga de datos correspondientes (ej. `loadDashboardData`, `loadTransactions`).
  - **Resultado:** Este patrón crea una aplicación reactiva. Cualquier cambio en la cartera activa (que haremos en el siguiente paso con un selector) se propagará automáticamente a todos los componentes suscritos, que se actualizarán sin necesidad de lógica de comunicación compleja entre ellos.
  - **Limpieza de Suscripciones (`ngOnDestroy`):** Se implementó el patrón `takeUntil(destroy$)` en todas las suscripciones de larga duración. En el `ngOnDestroy` del componente, se emite un valor en el `destroy$` Subject, lo que completa automáticamente todas las suscripciones activas. Esta es una práctica de nivel senior para prevenir fugas de memoria en aplicaciones SPA.

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

---

### Paso 24: Selector de Wallet en el Toolbar

- **Objetivo:** Cerrar el hueco dejado en el Paso 23 — permitir al usuario **cambiar** la cartera activa desde la UI, en lugar de quedar fijo siempre en la primera cartera devuelta por `GET /users/me`.

- **Implementación:**
  - **`WalletContextService`:** se agregó un segundo `BehaviorSubject` (`userWalletsSubject`, expuesto como `userWallets$`) que publica la lista completa de carteras del usuario — antes se guardaba en una propiedad privada sin forma de leerla desde fuera del servicio. También se agregó `setActiveWallet(wallet)`, que simplemente hace `.next()` sobre el `activeWalletSubject` ya existente.
  - **`DashboardLayoutComponent`:** el shell (sidenav + toolbar) ahora inyecta `WalletContextService` y expone `activeWallet$`/`userWallets$` a la plantilla. En el `mat-toolbar` se agregó un botón con `matMenuTriggerFor` que muestra el nombre de la cartera activa; al hacer clic despliega un `mat-menu` con todas las carteras del usuario (usando `*ngFor` sobre `userWallets$ | async`), marcando con un ícono distinto la que está actualmente activa. Al seleccionar una cartera se llama a `onSelectWallet(wallet)`, que delega en `walletContext.setActiveWallet(wallet)`.
  - **Sin cambios de backend:** los endpoints de dashboard/transacciones ya aceptaban `walletId` como query param desde los pasos anteriores, así que no fue necesario tocar el backend.

- **Por qué no hizo falta tocar `HomeComponent` ni `TransactionListComponent`:** ambos ya estaban suscritos a `activeWallet$` desde el Paso 23 (con `takeUntil(destroy$)`). En cuanto `setActiveWallet()` emite un nuevo valor, esas suscripciones se disparan solas y recargan sus datos — el selector solo necesitó **producir** el evento, no propagarlo manualmente. Esto confirma en la práctica el beneficio de desacoplamiento descrito en el Paso 22.

### Paso 25: Logout Funcional

- **Objetivo:** El link "Cerrar Sesión" del sidenav existía visualmente desde el Paso 15 pero no tenía ningún handler — no había forma de cerrar sesión desde la UI.
- **Implementación:**
  - **`AuthService`:** se agregó `logout()`, que simplemente hace `localStorage.removeItem('access_token')`. Sigue el mismo principio de responsabilidad única que ya tenía `login()` (el servicio solo gestiona el token; no navega).
  - **`DashboardLayoutComponent`:** se inyectan `AuthService` y `Router`; el nuevo método `logout()` llama a `authService.logout()` y luego navega a `/auth/login` con `router.navigate(...)`.
  - **Plantilla:** el `<a mat-list-item>` de "Cerrar Sesión" ahora tiene `(click)="logout()"`.
- **Por qué es seguro:** `authGuard` ya verificaba la presencia del token en `localStorage` antes de permitir el acceso a `/dashboard/*`; al borrarlo, cualquier intento de volver a una ruta protegida (o de recargar la página) redirige automáticamente a `/auth/login` sin lógica adicional.

### Paso 26: Página de Registro

- **Objetivo:** `RegisterComponent` era un stub vacío desde el Paso 10 (solo `<p>register works!</p>`), aunque la ruta `/auth/register` y el link desde el login ya existían. No había forma de crear una cuenta desde la UI.
- **Implementación:**
  - **`AuthService`:** se agregó `signup(credentials)`, que hace `POST /auth/signup` y tipa la respuesta como `User` (misma interfaz que ya se usaba para `GET /users/me`, ya que el backend devuelve la forma `{ id, email, name, memberships, ... }` sin la contraseña). A diferencia de `login()`, no guarda nada en `localStorage`: el backend de signup no devuelve `access_token`, solo crea el usuario (+ wallet personal, ya resuelto en el backend desde el Paso 5).
  - **`RegisterComponent`:** replica el mismo patrón que `LoginComponent` (Reactive Forms con `FormBuilder`/`FormControl` explícitos, mismas clases Material). Formulario con `name`, `email`, `password` (mínimo 8 caracteres, igual que el `SignUpDto` del backend). Al enviar, llama a `authService.signup(...)` y, si sale bien, navega a `/auth/login` para que el usuario inicie sesión con la cuenta recién creada.
  - **Plantilla/estilos:** se reutilizó la plantilla y el SCSS de `LoginComponent` (mismas clases `.login-container`/`.login-card`/`.login-form`), cambiando el título/subtítulo y agregando el campo `name`; el link de acciones ahora apunta de vuelta a `/auth/login`.
- **Decisión de UX (no auto-login):** se optó por redirigir a login en vez de encadenar automáticamente un `signin` tras el registro exitoso, para no acoplar el flujo de registro al de autenticación — mantiene cada método del `AuthService` con una sola responsabilidad, igual que `logout()` en el Paso 25.
- **Feedback al usuario:** al probarlo se notó que un registro exitoso no daba ninguna señal visible antes de redirigir. Primer intento con `MatSnackBar` (descartado, ver Paso 27) por sentirse poco visible; se reemplazó por el `NotificationService` + `AlertDialogComponent` centralizados del Paso 27.

### Paso 27: Servicio Centralizado de Notificaciones (`NotificationService`)

- **Objetivo:** el feedback de éxito/error del registro (Paso 26) se había resuelto con `MatSnackBar`, pero era poco visible (una barra abajo, poca duración) y no escalaba: cada componente hubiera tenido que repetir la misma lógica para mostrar mensajes de éxito/error, y el login tampoco daba ninguna señal de "sesión iniciada" ni de "credenciales incorrectas".
- **Decisión de diseño — `MatDialog` en vez de una librería externa (SweetAlert2):** el proyecto ya había migrado deliberadamente de Tailwind a "100% Angular Material" en el Paso 10 para mantener consistencia visual. Traer SweetAlert2 habría roto esa consistencia y sumado una dependencia externa más. En cambio, se reutilizó exactamente el mismo patrón que ya existía para `ConfirmDialogComponent` (Paso 21): un diálogo genérico reutilizable, pero para notificaciones informativas en lugar de confirmaciones.
- **Implementación:**
  - **`AlertDialogComponent`** (`shared/components/alert-dialog/`): diálogo genérico con `type: 'success' | 'error'` recibido por `MAT_DIALOG_DATA`, junto a `title`/`message`. Muestra un ícono grande (`check_circle` verde o `cancel` rojo según el tipo) y un único botón "Aceptar" que cierra el diálogo.
  - **`NotificationService`** (`core/services/notification.service.ts`, `providedIn: 'root'`): expone `success(message, title?)` y `error(message, title?)`, ambos abren el `AlertDialogComponent` vía `MatDialog.open(...)` (mismo `width: '350px'` que usa `ConfirmDialogComponent`) y devuelven el `MatDialogRef`, para que el llamador pueda encadenar lógica en `afterClosed()` si lo necesita.
  - **Consumo en `RegisterComponent`:** reemplaza el `MatSnackBar` anterior. Al tener éxito, se suscribe a `afterClosed()` del diálogo de éxito y recién ahí navega a `/auth/login` — el usuario ve y confirma el mensaje antes de que la pantalla cambie. Si falla, `notification.error(message)` muestra el error del backend (ej. "Credentials taken").
  - **Consumo en `LoginComponent`:** análogo — éxito muestra "Sesión iniciada correctamente" y navega a `/dashboard` recién al cerrar el diálogo; error muestra el mensaje del backend (`Invalid credentials`) con el título "Credenciales incorrectas".
  - **Limpieza:** se retiró `MatSnackBarModule` de `MATERIAL_MODULES` al quedar sin uso en todo el proyecto tras este reemplazo.

### Paso 28: Rediseño Visual (Theming M3 + Consistencia)

- **Objetivo:** al revisar la app completa (login, dashboard, transacciones) se notó que no había una identidad visual coherente — cada pantalla se había construido paso a paso sin una pasada de diseño unificada. Colores hardcodeados y sin relación entre sí (rosa en el fondo del login, cyan en la imagen de stock, índigo en los links, azul marino en el sidenav, azure en el tema base de Material) hacían que la app se sintiera "apagada" y sin vida.
- **Decisión de diseño — theming M3 en vez de hardcodear hex, sin sumar librerías:** el proyecto ya usa la API de theming M3 de Angular Material (`mat.theme(...)` en `styles.scss`), pero casi ningún componente la aprovechaba — seguían usando colores hex sueltos de versiones anteriores del diseño. La solución fue doble: (1) elegir una paleta más cálida y con identidad (`primary: mat.$green-palette` — asociación con dinero/crecimiento, en vez del azure genérico; `tertiary: mat.$violet-palette` como acento secundario), y (2) reemplazar los colores hardcodeados de cada componente por las variables CSS que Angular Material expone automáticamente (`--mat-sys-primary`, `--mat-sys-primary-container`, `--mat-sys-inverse-surface`, `--mat-sys-surface-container-low`, etc.), para que toda la app quede atada a un único origen de verdad.
- **Implementación:**
  - **`styles.scss`:** paleta cambiada a verde/violeta; `body` usa `var(--mat-sys-surface-container-low)` como fondo base en vez de blanco puro.
  - **Login/Registro:** se sacó la imagen de stock (`dinerin.jpg`, cyan, no combinaba con nada) y el fondo rosa hardcodeado. Se reemplazaron por un `hero-banner` con gradiente `primary → tertiary` y un ícono (`savings`) + el nombre de la marca — más parecido a una app fintech real que a una ilustración genérica. El fondo de la página ahora es un gradiente sutil `primary-container → surface-container-low`. El link "¿No tienes cuenta?" usa `var(--mat-sys-primary)` en vez del índigo hardcodeado (`#3f51b5`) que quedaba huérfano del resto del sistema.
  - **`DashboardLayoutComponent`:** el sidenav oscuro ahora usa `var(--mat-sys-inverse-surface)`/`var(--mat-sys-inverse-on-surface)` en vez de un azul marino hardcodeado — se adapta automáticamente si la paleta cambia en el futuro. El acento del link activo y el ícono de marca usan `var(--mat-sys-inverse-primary)` (token pensado específicamente para acentos sobre superficies oscuras). El contenido principal pasa de un gris plano (`#f4f7fa`) a `var(--mat-sys-surface-container-low)`.
  - **`HomeComponent` (dashboard principal):** las cards de resumen (Ingresos/Gastos/Balance) eran texto plano sin jerarquía. Se les agregó un ícono con badge circular de color (mismo lenguaje visual que ya usaban los íconos de la lista de transacciones desde el Paso 16), hover con elevación sutil, y radios de esquina consistentes (16px) con el resto de la app. El contenedor del gráfico pasó de `<div>` a `mat-card` para heredar el mismo estilo de superficie que todo lo demás.
- **Por qué no se tocó la lista/formulario de transacciones:** al revisarlos (`transaction-list.component.scss`) ya seguían un patrón razonable (cards redondeadas, badges de ícono con color, sombras suaves) — el problema de fondo estaba en login/dashboard-shell/home, no ahí.

### Paso 29: Reemplazo del Gráfico de Torta por Barras Horizontales

- **Objetivo:** el gráfico de "Gastos por Categoría" (`ngx-charts-pie-chart`, doughnut) se veía genérico/desprolijo y la leyenda se solapaba con pocas categorías — no ayudaba a entender rápido en qué se iba la plata. Se pidió explícitamente reemplazarlo por algo tipo barras con porcentajes.
- **Decisión (siguiendo la skill de dataviz del proyecto):** un donut es *part-to-whole*, pero la skill marca ese caso como "el donut queda deprioritizado — part-to-whole va en stacked bar". Como acá el objetivo real del usuario era comparar magnitud entre categorías (¿cuál se lleva más plata?), se optó por una **lista de barras horizontales rankeadas** (mayor a menor), con nombre de categoría, barra, monto y porcentaje visibles en cada fila — sin necesidad de leyenda aparte, porque cada barra ya lleva su propia etiqueta directa.
- **Paleta categórica:** se usó la paleta de referencia de 8 tonos de la skill (orden fijo, validada con `scripts/validate_palette.js` contra la superficie real de la app — pasa los 6 checks; el único WARN, contraste de texto en 3 tonos, ya está mitigado porque el color nunca se usa para texto, solo como relleno de barra/punto, y cada fila muestra monto y porcentaje como texto plano). Más de 8 categorías se pliegan en "Otros" en vez de generar un noveno color.
- **Implementación:**
  - **`HomeComponent`:** nuevo método `buildCategoryBars()` ordena las categorías por monto descendente, calcula el porcentaje sobre el total, asigna un color de la paleta fija por posición, y pliega el resto en "Otros" si hay más de 8. Se eliminó el estado `expensesByCategory`/`legendPosition` que ya no se usaba.
  - **Plantilla:** cada fila es un grid de 3 columnas (nombre con punto de color, barra, monto+porcentaje). La barra sigue los specs de la skill: grosor ≤24px, extremo redondeado en la punta y recto en la base, transición suave de ancho.
  - **Limpieza de dependencia:** `@swimlane/ngx-charts` (y su dependencia de D3) quedó sin ningún uso en el proyecto tras el reemplazo, así que se desinstaló (`npm uninstall`). Esto redujo el bundle lazy de `dashboard-routes` de ~1.33 MB a ~113 KB.

### Paso 30: Página de Gestión de Categorías y Subcategorías

- **Objetivo:** el link "Categorías" del sidenav era una ruta muerta desde el Paso 15 — el backend ya soportaba CRUD completo de categorías/subcategorías (Pasos 6 y 7), pero no había ninguna UI. El usuario las estaba creando manualmente en la base de datos.
- **Decisiones de diseño (discutidas antes de programar):**
  - **Layout — acordeón, no maestro-detalle:** una sola columna de categorías que se despliegan para mostrar sus subcategorías in-line (`mat-accordion` + `mat-expansion-panel`), con las acciones (crear subcategoría, editar, eliminar) directamente en el header de cada panel. Se eligió sobre un layout de dos columnas por ser más simple, más consistente con el patrón mobile-first ya usado en `TransactionListComponent`, y porque no hay tanta profundidad de datos como para justificar un panel de detalle aparte.
  - **Carga perezosa de subcategorías:** en vez de traer todas las subcategorías de todas las categorías al entrar a la pantalla, cada panel dispara `getSubcategoriesByCategory(categoryId)` recién la primera vez que se expande (evento `(opened)`), cacheando el resultado en `subcategoriesByCategory` para no repetir la llamada al volver a expandir.
  - **Borrado seguro (requería tocar el backend):** al planificar se detectó que `Subcategory → Category` tiene `onDelete: Cascade` en el schema, pero `Transaction → Subcategory` **no** — así que borrar una categoría/subcategoría que (o cuyas subcategorías) ya tiene transacciones asociadas rompía con un error 500 crudo de Postgres (violación de FK, código Prisma `P2003`). Se agregó manejo explícito en `CategoryService.deleteCategoryById` y `SubcategoryService.deleteSubcategoryById` (backend), mismo patrón que ya usaba `AuthService.signup` para el email duplicado (`P2002`): capturar `PrismaClientKnownRequestError` con código `P2003` y relanzar como `ConflictException` con un mensaje entendible ("No se puede eliminar: tiene transacciones asociadas").
- **Implementación:**
  - **Servicios frontend:** `CategoryService` y `SubcategoryService` (que antes solo tenían el `GET` usado por el formulario de transacciones) ahora exponen `create*`/`update*`/`delete*`, siguiendo el mismo estilo que `TransactionService`.
  - **`NameFormDialogComponent`** (nuevo, `shared/components/`): diálogo genérico de un solo campo de texto, reutilizado tanto para crear/editar categorías como subcategorías (recibe `title`/`label`/`initialValue` por `MAT_DIALOG_DATA` y devuelve el nombre validado por `afterClosed()`) — evita duplicar cuatro componentes casi idénticos.
  - **Borrado:** se reutilizó `ConfirmDialogComponent` (ya existente desde el Paso 21) tal cual, sin cambios.
  - **`CategoriesComponent`** (`dashboard/pages/categories/`, nueva ruta `/dashboard/categories` en `dashboard.routes.ts`, con lo que el link del sidenav deja de ser una ruta muerta): reactivo a `WalletContextService.activeWallet$` igual que `HomeComponent`/`TransactionListComponent`; maneja el estado de expansión/carga por categoría y delega éxito/error a `NotificationService` (los mismos modales de éxito/error del Paso 27 — incluyendo el mensaje de "tiene transacciones asociadas" cuando corresponde).
  - **Sin cambios necesarios en el formulario de transacciones:** `TransactionFormComponent` ya consulta `CategoryService`/`SubcategoryService` en vivo cada vez que se abre el diálogo, así que cualquier categoría/subcategoría creada desde la nueva pantalla aparece automáticamente en el `select` sin tocar ese componente.
  - **`MATERIAL_MODULES`:** se agregaron `MatExpansionModule` y `MatTooltipModule`, usados por primera vez en esta pantalla.
- **Ajustes tras probarlo:**
  - **Contraste del texto del sidenav:** al probar se notó que el texto de los links (`Dashboard`, `Transacciones`, etc.) casi no se veía sobre el fondo oscuro. Causa: `mat-list-item` pinta su texto/ícono con tokens propios de Material (`--mdc-list-list-item-label-text-color`, etc.) aplicados directamente sobre el elemento interno, no heredados del `<a>` — así que el `color` puesto a mano en el selector `a` nunca ganaba. Se corrigió con `@include mat.list-overrides(...)` (la API de theming de Material, no CSS a mano) para fijar el color de texto/ícono en reposo, hover y foco, más una transición suave de `background-color` en hover que antes no existía.
  - **Ancho de la pantalla de Categorías — de acordeón a grilla:** primero se probó solo ensanchar el contenedor del acordeón (`max-width: 720px` → `1100px`), pero seguía sin sentirse "lleno" en pantallas anchas. Se optó entonces por reemplazar el acordeón por una **grilla responsive de cards** (`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`, sin `max-width` fijo en el contenedor) — cada categoría es una card con sus subcategorías listadas siempre visibles adentro (ya no hace falta expandir/colapsar). Esto también cambió la estrategia de carga: en vez de cargar las subcategorías de una categoría recién al expandir su panel (`(opened)`), ahora se cargan todas en paralelo apenas llegan las categorías, porque en la grilla todo está a la vista de entrada. `MatExpansionModule` quedó sin uso tras el cambio y se sacó de `MATERIAL_MODULES`.
  - **Orden de transacciones (bug):** `GET /transactions` ordenaba solo por `date` (la fecha que elige el usuario al crear la transacción). Al probar, una transacción recién creada no aparecía como la primera de la lista cuando había otras con la misma fecha — Postgres no garantiza el orden entre filas empatadas sin un criterio de desempate. Se agregó `createdAt` como segundo criterio (`orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]`), así entre transacciones con la misma fecha, la creada más recientemente queda primera.
  - **Orden de categorías/subcategorías (decisión, no bug):** al probar la pantalla nueva se notó que una subcategoría recién creada ("Feria" en "Alimentación") no aparecía primera — a diferencia de las transacciones, acá no era un bug: `CategoryService`/`SubcategoryService` ordenaban a propósito por `name: 'asc'` desde los Pasos 6-7 (útil para encontrar una categoría en una lista larga). Se decidió priorizar consistencia con el comportamiento de "más reciente primero" que ya tienen las transacciones, y se cambió a `orderBy: { createdAt: 'desc' }` en ambos servicios. Esto también cambia el orden de las categorías/subcategorías en los `select` del formulario de transacciones y de los filtros, porque reutilizan los mismos endpoints.

### Paso 31: Alerta de Gasto del Mes ("carita" de estado)

- **Objetivo:** primer paso del roadmap de features "MVP para uso en pareja" que se conversó con el usuario (alertas de gasto, metas de ahorro, colaboración en wallet compartida — se decidió arrancar por esta, la más rápida de tener funcionando). Mostrar en el dashboard, de un vistazo, si el gasto del mes está bien encaminado respecto a lo que entró, con una cara (🙂/😐/🙁/😡) según el porcentaje.
- **Decisión de diseño — resumen mensual separado del resumen histórico:** `DashboardService.getWalletSummary` (`/dashboard/summary`, usado por las cards de Ingresos/Gastos/Balance) suma transacciones de **toda la vida de la wallet** — es el balance histórico y no se tocó. Para "cuánto gasté este mes" hacía falta algo distinto, así que se agregó un endpoint nuevo (`GET /dashboard/monthly-summary`) en vez de mezclar ambos conceptos en el mismo método.
  - `DashboardService.getMonthlySummary(userId, walletId)`: suma INCOME/EXPENSE filtrando `date >= inicio del mes actual`, devuelve `{ totalIncome, totalExpense, percentageSpent }`. `percentageSpent` es `null` cuando no hay ingresos cargados ese mes (evita división por cero y le da a la UI un estado distinto de "0% gastado").
- **Frontend (`HomeComponent`):** función pura `buildSpendingMood(percentage)` mapea el porcentaje a un ícono de Material (`sentiment_very_satisfied` / `sentiment_satisfied` / `sentiment_dissatisfied` / `sentiment_very_dissatisfied` / `sentiment_neutral` si no hay datos) + un color de una **paleta de estado fija** (verde/amarillo/naranja/rojo — la misma paleta reservada de la skill de dataviz usada en el resto del proyecto, que nunca sigue el tema de la app) + un mensaje. Umbrales: <50% tranquilo, 50-80% atención, 80-100% cuidado, >100% te pasaste.
- **Por qué no se reutilizó el color del tema:** un estado (bien/mal) no debe depender de la paleta de marca — si cambia el verde/violeta del tema a futuro, la semántica de "estás gastando demasiado" tiene que seguir siendo roja sí o sí. Es la regla de "status colors are reserved, nunca siguen el theme" de la skill de dataviz.
- **Bug relacionado encontrado al probar:** la card de "Balance" del Paso 28 (rediseño visual) coloreaba el monto siempre con `var(--mat-sys-primary)` (verde del tema), incluso con balance negativo — mismo error de fondo que motivó este paso: un valor con significado bien/mal no puede depender solo del color de marca. Se agregó una clase `.negative` condicional (`summary.balance < 0`) que fuerza rojo cuando el balance es negativo.

### Paso 32: Separar Dashboard en "Este mes" vs. "Histórico" + Aviso de Inversión

- **Objetivo:** al usar la carita del Paso 31 se detectó una ambigüedad real: las cards "Ingresos Totales"/"Gastos Totales"/"Balance" (Paso 14) son **históricas** (desde siempre), pero se mostraban justo al lado de la carita, que es **mensual** — un usuario podía ver "Balance: $2.000.000" y "gastaste el 90%" y sentir que la información se contradice, cuando en realidad hablan de períodos distintos (plata ahorrada de meses anteriores vs. qué tan ajustado vas este mes).
- **Decisión — dos secciones con alcance temporal explícito, sin endpoint nuevo:**
  - **"Este mes"**: la carita + tres cards nuevas (Ingresos del mes / Gastos del mes / Balance del mes), todas derivadas de `monthlySummary` (Paso 31) — `monthlyBalance = totalIncome - totalExpense` se computa en el frontend, no hace falta tocar el backend.
  - **"Histórico"**: las tres cards originales (ahora explícitamente tituladas "Ingresos Totales" / "Gastos Totales" / "Balance Total"), sin cambios de datos — vienen de `getWalletSummary` como siempre.
  - Cada sección tiene un `<h2>` + una leyenda chica aclarando el alcance ("Movimiento del mes en curso" / "Desde que empezaste a usar esta cartera"), separadas visualmente con un borde inferior — así el usuario nunca tiene que inferir a qué período corresponde un número.
- **Aviso de inversión (nuevo, simple a propósito):** si el balance histórico supera $500.000 (`INVESTMENT_TIP_THRESHOLD`, constante en el componente), aparece un banner en la sección "Histórico" sugiriendo invertir parte del saldo ocioso. Es deliberadamente simple — no hay configuración de umbral ni categoría "Inversiones" involucrada, solo una sugerencia basada en el balance histórico total.
- **Decisiones descartadas (conversadas con el usuario):**
  - **Botón de "reset/reiniciar wallet"**: se decidió NO construirlo. Es una wallet compartida entre dos personas — un borrado masivo sin deshacer representa más riesgo (podés destruir el historial del otro por error) que valor real, dado que ya existe borrado individual con confirmación (Paso 21). Para limpiar datos de prueba, Prisma Studio es la herramienta correcta (fuera del alcance de un click accidental en la UI).
  - **Campo de "sueldo" separado de las transacciones**: se decidió NO agregarlo. El % de gasto ya se calcula sumando todas las transacciones tipo Ingreso del mes: agregar un campo de sueldo aparte duplicaría el modelo de datos y crearía dos lugares distintos para registrar plata que entra. Cargar el sueldo (o cualquier otro ingreso) como transacción tipo Ingreso ya es el flujo correcto.
- **Ajuste tras probarlo — nombre del mes dinámico:** los labels "Ingresos del mes"/"Gastos del mes"/"Balance del mes" ahora muestran el mes actual en vez de la palabra genérica "mes" (ej. "Gastos de Agosto"). `currentMonthLabel` se calcula una vez en el componente con `formatDate(new Date(), 'MMMM', 'es-CL')` (mismo locale `es-CL` que ya usa el resto de la app, Paso 17) y se capitaliza a mano, ya que Angular no capitaliza los nombres de mes en español por defecto.

### Paso 33: Gráfico de Ingresos por Categoría

- **Objetivo:** al crear una categoría "Ingresos" con subcategorías, el usuario notó que no aparecía en el gráfico de "Gastos por Categoría" — correcto, porque ese endpoint filtra `type: EXPENSE` a propósito, pero no existía el equivalente para ingresos.
- **Backend — DRY en vez de copiar el método:** `DashboardService.getExpensesByCategory` y el nuevo `getIncomeByCategory` comparten toda la lógica de agrupar por subcategoría y enriquecer con el nombre de la categoría; se extrajo a un privado `getAmountsByCategory(walletId, type)` parametrizado por `TransactionType`, y ambos métodos públicos son ahora una línea cada uno. Nuevo endpoint `GET /dashboard/income-by-category`.
- **Frontend — componente compartido en vez de duplicar el markup:** la lista de barras horizontales (puntito de color + barra + monto + porcentaje) se extrajo de `HomeComponent` a `CategoryBarsComponent` (`shared/components/category-bars/`, standalone, recibe `title`/`bars` por `@Input()`), porque iba a necesitarse dos veces (gastos e ingresos) con el mismo look. `HomeComponent` ahora solo arma los datos (`expenseCategoryBars`/`incomeCategoryBars`, ambos con el mismo `buildCategoryBars()` genérico que ya existía) y las renderiza una al lado de la otra en una grilla responsive (`repeat(auto-fit, minmax(320px, 1fr))`).
- **Ajuste tras probarlo — ingresos por subcategoría, no por categoría:** al probarlo, el gráfico de ingresos mostraba nombres de categoría ("Ingresos", "Deporte", "Hogar") en vez de las subcategorías reales ("Remuneraciones", "Extras") que el usuario había definido. Tenía sentido para gastos (pocas categorías grandes: Alimentación, Transporte...) pero no para ingresos, que suelen vivir todos bajo una sola categoría con el detalle real en las subcategorías — agrupar por categoría los mezclaba en un solo bloque sin decir nada. Se generalizó `getAmountsByCategory` a `getAmountsBreakdown(walletId, type, groupLevel)`, con `groupLevel: 'category' | 'subcategory'`: gastos sigue agrupando por categoría, ingresos ahora agrupa por subcategoría. El título del gráfico en el frontend pasó de "Ingresos por Categoría" a "Ingresos por Subcategoría" para reflejarlo.

### Paso 34: Saludo al Usuario en el Toolbar

- **Objetivo:** el toolbar mostraba el nombre de la wallet activa como único texto ("Personal"), sin ningún saludo personalizado ni aclaración de que ese texto representa la cartera en la que estás parado — se sentía frío/genérico para una app pensada para usarse en pareja.
- **Implementación:**
  - **`WalletContextService`:** se agregó un tercer `BehaviorSubject` (`currentUserSubject`, expuesto como `currentUser$`) que guarda el `User` completo devuelto por `getMe()` — antes `loadUserWallets()` descartaba todo excepto las wallets. No hizo falta ninguna llamada HTTP nueva, el dato ya venía en la respuesta que se pedía de todos modos.
  - **`DashboardLayoutComponent`/toolbar:** se agregó un bloque "¡Hola, {{ nombre }}!" (con `user.email` como respaldo si no cargó nombre) a la izquierda del selector de wallet, y el botón del selector pasó de mostrar solo el nombre a "Cartera: {{ nombre }}" para que quede explícito qué es ese texto.
  - **Responsive:** en pantallas angostas (`max-width: 700px`) el saludo se oculta y solo queda el selector de wallet, que es lo accionable — mismo criterio mobile-first que ya se usa en otras partes de la app (ej. el FAB de transacciones, Paso 16).

### Paso 35: Wallets Compartidas — Crear e Invitar

- **Objetivo:** el modelo de datos soporta wallets compartidas desde el Paso 5 (`WalletType.SHARED`, `WalletMembership` con roles OWNER/MEMBER), pero nunca existió ninguna forma de **crear** una ni de agregar a un segundo miembro — solo se creaba automáticamente una wallet personal en el signup. Sin esto, la wallet compartida era infraestructura sin usar: la razón de ser del proyecto (usarlo en pareja) no era alcanzable todavía.
- **Decisiones de diseño (conversadas antes de programar):**
  - **No hace falta una pantalla/dashboard aparte para la wallet compartida.** El selector de wallet del toolbar (Paso 24) y el patrón reactivo de `WalletContextService` (Paso 22-23) ya hacen que Dashboard/Transacciones/Categorías se recalculen solos según la wallet activa — una wallet compartida es simplemente una opción más en ese mismo selector, sin construir nada nuevo para "entrar" a ella.
  - **Alta directa, sin flujo de invitación pendiente/aceptar.** Al crear la wallet compartida, se agrega a la persona invitada de una (busca por email entre usuarios existentes) — no hay estado "invitación pendiente" ni notificación. Si el email no tiene cuenta, error claro pidiendo que se registre primero. Para dos personas de confianza que van a coordinar por afuera, un sistema de invitaciones con tokens/emails es complejidad que no aporta al MVP.
  - **Permisos parejos entre OWNER y MEMBER**, no distinción por rol. Al plantear el flujo se detectó que categorías/subcategorías (crear/editar/borrar) y transacciones (editar/borrar) exigían `ownerRequired: true` — es decir, un MEMBER invitado a una wallet compartida no podría haber creado categorías propias ni editado sus propias transacciones. Se sacó esa restricción en los tres servicios (`CategoryService`, `SubcategoryService`, `TransactionService`): ahora alcanza con ser miembro de la wallet, cualquier rol, para todas esas acciones. `checkWalletMembership(..., ownerRequired)` se mantiene con soporte para restricción por OWNER a futuro (por ejemplo, para borrar la wallet completa o sacar a un miembro — no existe todavía), pero ningún llamado actual lo usa.
  - **No hay sincronización en tiempo real.** Cada quien ve los datos de la wallet compartida al cargar/refrescar una pantalla, no mientras la otra persona está escribiendo en simultáneo (no hay WebSockets). Suficiente para el caso de uso real (cada uno carga sus gastos cuando puede) y evita una complejidad técnica grande que no está en el alcance del MVP.
- **Implementación:**
  - **Backend — `WalletModule` nuevo** (`wallet.controller.ts`, `wallet.service.ts`, `dto/create-shared-wallet.dto.ts`): `POST /wallets/shared` recibe `{ name, inviteEmail }`. Busca el usuario invitado por email (404 con mensaje claro si no existe, 409 si el invitado es uno mismo), y crea la `Wallet` (`type: SHARED`) con ambas `WalletMembership` (OWNER para quien crea, MEMBER para el invitado) en una sola escritura anidada de Prisma — mismo patrón atómico que ya usaba el signup (Paso 5).
  - **Frontend — `WalletService`** (`wallet/services/`, nuevo): `createSharedWallet(...)`. **`CreateSharedWalletDialogComponent`** (`shared/components/`, nuevo): diálogo con dos campos (nombre, email) y su propia validación de email.
  - **`DashboardLayoutComponent`:** el `mat-menu` del selector de wallet ahora tiene, debajo de la lista de wallets, un separador (`MatDividerModule`, agregado a `MATERIAL_MODULES`) y un botón "Nueva wallet compartida". Al crear con éxito, se llama de nuevo a `walletContext.loadUserWallets()` (el mismo método que ya existía) para refrescar la lista sin recargar la página, y se muestra un `NotificationService.success(...)`.
- **Bug encontrado al probar — "Cerrar Sesión" invisible:** el fix de contraste del sidenav (Paso 34) aplicaba `mat.list-overrides(...)` solo dentro de `mat-nav-list`, pero el link de "Cerrar Sesión" vive en `.sidenav-footer`, un `<div>` hermano fuera de esa lista — no heredaba los tokens de color y quedaba con el texto oscuro por defecto de Material sobre el fondo oscuro del sidenav (invisible). Se subió el `@include mat.list-overrides(...)` a nivel `.sidenav` (contenedor común de `mat-nav-list` y `.sidenav-footer`) para que alcance a ambos.
- **Copiar categorías al crear la wallet compartida:** como `Category` está atada a un `walletId` específico, una wallet compartida nueva arranca sin ninguna categoría — nada se hereda de la wallet personal. Se agregó un checkbox opcional "Copiar categorías desde una wallet existente" en `CreateSharedWalletDialogComponent` (con un `mat-select` de las wallets del usuario, usando `WalletContextService.userWallets$`). El backend (`WalletService.createSharedWallet`) recibe `copyCategoriesFromWalletId` opcional en el DTO, verifica que el usuario sea miembro de esa wallet origen (no se puede copiar de una wallet ajena), y arma la creación de la nueva wallet con `categories: { create: [...] }` anidado (cada categoría con sus `subcategories: { create: [...] }`) — mismo `wallet.create` atómico de siempre, ahora con category tree incluido. Solo se copian nombres/estructura, nunca transacciones.
