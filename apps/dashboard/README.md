# Deck Dashboard (`apps/dashboard`)

React + Vite admin web UI for Deck.

## Purpose

- Provide browser-based operations UI for backend APIs.
- Consume generated OpenAPI clients and shared TS utilities.

## Entrypoints

- App bootstrap: `src/main.tsx`
- App shell: `src/App.tsx`
- Routes: `src/routes/*`

## Development

```bash
# Run dashboard
make run-dashboard

# Core checks
pnpm --filter @cofy-x/deck-dashboard run typecheck
pnpm --filter @cofy-x/deck-dashboard run lint
```

## API Client Generation

```bash
pnpm --filter @cofy-x/deck-dashboard run api:gen
```

## Notes for AI Agents

- Follow `.x/guide-frontend.md` for React conventions.
- Avoid hardcoding API contracts when generated clients exist.
