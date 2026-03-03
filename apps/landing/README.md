# Deck Landing (`apps/landing`)

Marketing landing page for Deck at `https://deck.cofy-x.space`.

## Purpose

- Present Deck value proposition and architecture in a high-conversion single page.
- Emphasize the cockpit-to-development handoff loop: Start Sandbox -> Observe Desktop -> Continue in Editor/OpenCode/Terminal.
- Present Pilot as an optional ecosystem capability (secondary to the cockpit narrative).
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

## Demo Assets

`public/demo.mp4` is the source of truth for the hero demo.

After replacing `demo.mp4`, regenerate sibling assets with:

```bash
pnpm --filter @cofy-x/deck-landing run assets:demo
```

Generated files:

- `public/demo.webm`
- `public/demo.gif` (first 10 seconds fallback for browsers without video support)
- `public/demo-poster.png`

Requirements:

- `ffmpeg` available in `PATH`

Optional tuning env vars:

- `WEBM_WIDTH` (default `1280`)
- `WEBM_CRF` (default `34`)
- `GIF_WIDTH` (default `960`)
- `GIF_FPS` (default `10`)
- `GIF_DURATION_SECONDS` (default `10`)
- `POSTER_TIMESTAMP` (default `00:00:01`)

## Deployment

- Docker assets: `docker/landing/`
- Compose file: `deploy/landing/docker-compose.yml`
- Runbook: `docs/design/landing-deploy.md`
- GitHub Actions image workflow: `.github/workflows/landing-image.yml`
- GitHub Actions Pages workflow: `.github/workflows/landing-pages-deploy.yml`
