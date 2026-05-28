# =============================================================================
# ingest-service — Multi-stage build
# =============================================================================

# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Instala TODAS as dependências no builder (incluindo devDeps como @nestjs/cli)
RUN npm ci

# Copia o schema do Prisma antes do build para que "prisma generate" funcione
COPY prisma ./prisma
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
# Schema necessário para o Prisma Client em runtime
COPY --from=builder /app/prisma ./prisma
# Instala apenas dependências de produção (sem devDeps)
COPY package*.json ./
RUN npm ci --omit=dev

# Usuário não-root por segurança
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "dist/main"]
