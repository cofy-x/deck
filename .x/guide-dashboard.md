# Guide: apps/dashboard — Admin Web UI

## Purpose

`apps/dashboard` is the browser-based admin interface for Deck APIs.

## Boundaries

- Owns dashboard routing, table/forms UI, and API integration for admin workflows.
- Uses generated API clients and shared TS utilities.
- Does not manage desktop runtime or sandbox daemon lifecycle.

## Entrypoints

- App root: `apps/dashboard/src/main.tsx`
- App shell: `apps/dashboard/src/App.tsx`
- Routes: `apps/dashboard/src/routes/*`
- Shared client helpers: `apps/dashboard/src/lib/*`

## Dev Commands

```bash
# Run dashboard
make run-dashboard

# Package scripts
pnpm --filter @cofy-x/deck-dashboard run dev
pnpm --filter @cofy-x/deck-dashboard run typecheck
pnpm --filter @cofy-x/deck-dashboard run build
```

## Config / Env

- Dashboard APIs are generated with Orval.
- Regenerate API client after API schema changes:
  - `pnpm --filter @cofy-x/deck-dashboard run api:gen`

## Tests

- Type checks: `pnpm --filter @cofy-x/deck-dashboard run typecheck`
- Lint checks: `pnpm --filter @cofy-x/deck-dashboard run lint`

## Read Next

- `apps/dashboard/README.md`
- `.x/guide-frontend.md`
- `.x/guide-api.md`

## Common Pitfalls

- Do not hardcode API contracts when generated clients already exist.
- Keep route and state updates aligned with TanStack Router and Query patterns.
