FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm

# 先只複製 package.json 以利用 Docker layer cache
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json     ./apps/server/
COPY apps/worker/package.json     ./apps/worker/
RUN pnpm install --frozen-lockfile

# ----

FROM base AS builder

COPY tsconfig.base.json ./

# Prisma Client 生成需要 schema.prisma 和 node_modules/.prisma，才能正確解析 generator 和 datasource
COPY prisma ./prisma
RUN pnpm exec prisma generate

# 依照依賴順序 build：shared → server, worker
COPY packages/shared ./packages/shared
RUN pnpm --filter @daniel/shared build

COPY apps/server ./apps/server
RUN pnpm --filter @daniel/server build

COPY apps/worker ./apps/worker
RUN pnpm --filter @daniel/worker build

# ----

# migrator：執行 prisma migrate deploy（base 含 devDeps，prisma CLI 可用）
FROM base AS migrator
COPY prisma ./prisma
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ----

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json     ./apps/server/
COPY apps/worker/package.json     ./apps/worker/
RUN pnpm install --frozen-lockfile --prod

# Prisma generated client（純 JS，tsc 不會複製到 dist，需手動搬）
COPY --from=builder /app/packages/shared/src/generated/prisma/client ./packages/shared/dist/generated/prisma/client

# dist（編譯產物）
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist     ./apps/server/dist
COPY --from=builder /app/apps/worker/dist     ./apps/worker/dist

COPY apps/server/public ./apps/server/public

# CMD 由 docker-compose 各服務覆寫
CMD ["node", "apps/server/dist/index.js"]
