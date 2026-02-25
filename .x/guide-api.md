# Guide: apps/api — NestJS BFF

## Purpose

`apps/api` is the backend-for-frontend service for Deck web surfaces. It exposes REST APIs for dashboard and orchestrates persistence and background jobs.

## Boundaries

- Owns HTTP API contracts and request validation for API domain modules.
- Owns integration with PostgreSQL/Redis/BullMQ in backend workflows.
- Does not own desktop runtime logic from `apps/client` or Pilot sidecars.

## Entrypoints

- App bootstrap: `apps/api/src/main.ts`
- Root module: `apps/api/src/app.module.ts`
- Feature modules: `apps/api/src/modules/*`
- Common utilities: `apps/api/src/common/*`

## Dev Commands

```bash
# Run API in development
make run-api

# Or run package scripts directly
pnpm --filter @cofy-x/deck-api run dev
pnpm --filter @cofy-x/deck-api run typecheck
pnpm --filter @cofy-x/deck-api run test
```

## Config / Env

- Copy `apps/api/.env.example` to `.env` before local startup.
- Common DB flow:
  - `pnpm --filter @cofy-x/deck-api run db:push`
  - `pnpm --filter @cofy-x/deck-api run db:migrate`

## Tests

- Unit/integration tests use Vitest via `pnpm --filter @cofy-x/deck-api run test`.
- Type correctness via `pnpm --filter @cofy-x/deck-api run typecheck`.

## Read Next

- `apps/api/README.md`
- `apps/dashboard/README.md`
- `.x/coding-standards.md`

## Common Pitfalls

- Do not duplicate shared DTO/logic that should live in `packages/core-ts`.
- Keep generated outputs in `dist/` out of manual edits.
