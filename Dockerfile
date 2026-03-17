FROM node:20-alpine AS base
WORKDIR /app
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
COPY prisma ./prisma
RUN pnpm exec prisma generate

# 依照依賴順序 build：shared → server, worker
COPY packages/shared ./packages/shared
RUN pnpm --filter @daniel/shared build

COPY apps/server ./apps/server
COPY apps/worker ./apps/worker
RUN pnpm --filter @app/server build
RUN pnpm --filter @app/worker build

# ----

FROM node:20-alpine AS production
WORKDIR /app
RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json     ./apps/server/
COPY apps/worker/package.json     ./apps/worker/
RUN pnpm install --frozen-lockfile --prod

# dist（編譯產物）
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist     ./apps/server/dist
COPY --from=builder /app/apps/worker/dist     ./apps/worker/dist

# Prisma generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# swagger-jsdoc 需要讀取 .ts 原始檔取得 JSDoc 註解
COPY apps/server/src ./apps/server/src

COPY prisma            ./prisma
COPY apps/server/public ./apps/server/public
RUN mkdir -p /app/uploads

# CMD 由 docker-compose 各服務覆寫
CMD ["node", "apps/server/dist/index.js"]
