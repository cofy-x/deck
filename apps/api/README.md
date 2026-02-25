# Deck API (`apps/api`)

NestJS backend-for-frontend service for Deck web surfaces.

## Purpose

- Provide REST APIs for admin/dashboard use cases.
- Coordinate persistence and background tasks with PostgreSQL, Redis, and BullMQ.

## Entrypoints

- Bootstrap: `src/main.ts`
- Root module: `src/app.module.ts`
- Feature modules: `src/modules/*`

## Development

```bash
# Prepare infra (Redis + DB)
make docker-dev-up

# Run API in dev mode
make run-api
```

Equivalent package commands:

```bash
pnpm --filter @cofy-x/deck-api run dev
pnpm --filter @cofy-x/deck-api run typecheck
pnpm --filter @cofy-x/deck-api run test
```

## Configuration

- Copy `apps/api/.env.example` to `.env`.
- Schema operations:
  - `pnpm --filter @cofy-x/deck-api run db:push`
  - `pnpm --filter @cofy-x/deck-api run db:migrate`

## Notes for AI Agents

- Keep shared business logic and cross-app types in `packages/core-ts`.
- Treat `dist/` as build output only.
