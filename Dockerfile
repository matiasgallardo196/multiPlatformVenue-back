# --- Build stage ---
    FROM node:20-alpine AS builder
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    # Si usas Prisma, descomenta:
    # RUN npx prisma generate
    RUN npm run build
    
    # --- Runtime stage ---
    FROM node:20-alpine
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3001
    # Copiamos solo lo necesario para producción
    COPY --from=builder /app/package*.json ./
    RUN npm ci --omit=dev
    COPY --from=builder /app/dist ./dist
    # Si usas Prisma (migraciones/esquema):
    # COPY --from=builder /app/prisma ./prisma
    
    EXPOSE 3001
    CMD ["node", "dist/main.js"]
    