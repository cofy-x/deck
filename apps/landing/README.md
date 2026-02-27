# Deck Landing (`apps/landing`)

Marketing landing page for Deck at `https://deck.cofy-x.space`.

## Purpose

- Present Deck value proposition and architecture in a high-conversion single page.
- Provide direct conversion paths to Releases, repository, and docs.
- Stay fully static for lightweight image packaging and manual deployment.

## Entrypoints

- App bootstrap: `src/main.tsx`
- App shell: `src/App.tsx`
- Localized content model: `src/content/site-content.ts`

## Development

```bash
make run-landing
pnpm --filter @cofy-x/deck-landing run typecheck
pnpm --filter @cofy-x/deck-landing run build
```

## Deployment

- Docker assets: `docker/landing/`
- Compose file: `deploy/landing/docker-compose.yml`
- Runbook: `docs/design/landing-deploy.md`
- GitHub Actions image workflow: `.github/workflows/landing-image.yml`
- GitHub Actions Pages workflow: `.github/workflows/landing-pages-deploy.yml`
