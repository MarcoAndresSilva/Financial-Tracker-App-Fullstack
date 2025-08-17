# ---- Base Stage ----
# Usamos una imagen oficial de Node.js como base.
# '18-alpine' es una versión ligera y segura, ideal para producción.
FROM node:18-alpine AS base

# Establecemos el directorio de trabajo dentro del contenedor.
WORKDIR /usr/src/app

# ---- Dependencies Stage ----
# Copiamos los archivos de definición de paquetes ANTES que el resto del código.
# Esto aprovecha el sistema de caché de Docker. Si estos archivos no cambian,
# Docker no volverá a ejecutar 'npm install', acelerando las builds.
FROM base AS dependencies
COPY package*.json ./
RUN npm install

# ---- Build Stage ----
# Aquí construiremos la aplicación para producción.
FROM dependencies AS build
# Copiamos todo el código fuente.
COPY . .
# Ejecutamos el script de build de NestJS.
RUN npm run build

# ---- Production Stage ----
# Esta es la etapa final, la que se usará para correr la aplicación.
# Empezamos desde la imagen base para mantener la imagen final lo más pequeña posible.
FROM base AS production
# Copiamos solo los artefactos necesarios desde las etapas anteriores.
COPY --from=build /usr/src/app/dist ./dist
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=dependencies /usr/src/app/package*.json ./

# El comando que se ejecutará cuando el contenedor se inicie.
CMD ["node", "dist/main"]