# Client Daemon TypeScript SDK (`packages/client-daemon-ts`)

TypeScript client SDK for Deck daemon HTTP APIs.

## Purpose

- Provide typed API client wrappers for daemon endpoints.
- Serve `apps/client` and other TS consumers.

## Entrypoints

- Public exports: `src/index.ts`
- Generated client: `src/DaemonClient.ts` and generated `src/{core,models,services}/*`
- Build output: `dist/*`

## Development

```bash
pnpm --filter @cofy-x/client-daemon run build
pnpm --filter @cofy-x/client-daemon run type-check
pnpm --filter @cofy-x/client-daemon run generate
```

## Notes for AI Agents

- Regenerate from daemon Swagger when API changes.
- Avoid manual edits in generated files unless the generator workflow is updated as well.
