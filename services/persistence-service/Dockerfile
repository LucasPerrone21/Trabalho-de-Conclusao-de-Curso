# =============================================================================
# persistence-service — Multi-stage Dockerfile
# Stage 1: build + prisma generate
# Stage 2: produção mínima
# =============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Instala dependências de build (incluindo devDependencies para nest build)
COPY package*.json ./
RUN npm ci

# Gera o Prisma Client tipado antes do build TypeScript
COPY prisma ./prisma
RUN npx prisma generate

# Compila TypeScript
COPY . .
RUN npm run build

# =============================================================================
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Apenas dependências de runtime
COPY package*.json ./
RUN npm ci --omit=dev

# Copia artifacts de build e Prisma Client gerado
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

CMD ["node", "dist/main"]
