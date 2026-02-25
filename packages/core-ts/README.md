# Core TypeScript (`packages/core-ts`)

Shared TypeScript utilities and types consumed across Deck apps.

## Purpose

- Host reusable TS domain logic.
- Reduce duplication across `apps/api`, `apps/dashboard`, and other TS apps.

## Entrypoints

- Source: `src/index.ts`
- Build output: `dist/*`

## Development

```bash
pnpm --filter @cofy-x/deck-core-ts run build
pnpm --filter @cofy-x/deck-core-ts run type-check
pnpm --filter @cofy-x/deck-core-ts run lint
```

## Notes for AI Agents

- Add exported reusable interfaces/utilities here before copying logic into multiple apps.
- Do not edit generated files under `dist/`.
