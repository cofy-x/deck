FROM node:20-alpine AS builder

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/package.json

RUN pnpm install --frozen-lockfile --filter @cofy-x/deck-landing...

COPY . .
RUN pnpm --filter @cofy-x/deck-landing run build

FROM nginx:1.27-alpine

COPY docker/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/landing/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
