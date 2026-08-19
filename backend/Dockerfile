# ---- Base Stage ----
FROM node:18-alpine AS base
WORKDIR /usr/src/app

# ---- Dependencies Stage ----
# Esta etapa solo instala las dependencias.
FROM base AS dependencies
COPY package*.json ./
RUN npm install

# ---- Build Stage ----
# Esta etapa construye la aplicación y genera el cliente de Prisma.
# Es nuestra "fuente de verdad" para todos los artefactos de producción.
FROM dependencies AS build
COPY . .
# El script "build" ahora ejecuta "prisma generate && nest build"
RUN npm run build

# ---- Production Stage ----
# Esta es la imagen final que correrá.
FROM base AS production
ENV NODE_ENV=production
# Copiamos package.json para que los gestores de paquetes sepan qué dependencias son de producción.
COPY --from=build /usr/src/app/package*.json ./
# Copiamos los node_modules desde la etapa de BUILD, no de DEPENDENCIES.
# Esta es la corrección clave, ya que esta carpeta contiene el cliente de Prisma generado.
COPY --from=build /usr/src/app/node_modules ./node_modules
# Copiamos el código compilado.
COPY --from=build /usr/src/app/dist ./dist
# Copiamos prisma/ (schema + migraciones) para poder aplicarlas al arrancar.
COPY --from=build /usr/src/app/prisma ./prisma

# Aplica las migraciones pendientes contra la base de datos de producción
# (`migrate deploy`, no `migrate dev` — no genera migraciones nuevas ni pide
# confirmación, solo aplica las que ya existen) y recién ahí arranca la app.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]