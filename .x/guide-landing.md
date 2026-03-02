# Guide: apps/landing — Marketing Website

## Purpose

`apps/landing` is the public marketing website for Deck. It focuses on product communication, demo presentation, and onboarding links.

## Boundaries

- Owns landing-page content, presentation, and public navigation links.
- Prioritizes static/local content delivery and lightweight runtime behavior.
- Does not own authenticated app workflows, dashboard data operations, or sandbox lifecycle control.

## Entrypoints

- App root: `apps/landing/src/main.tsx`
- Main page shell: `apps/landing/src/App.tsx`
- Site content source: `apps/landing/src/content/site-content.ts`
- Shared UI primitives: `apps/landing/src/components/ui/*`
- Shared utility helper: `apps/landing/src/lib/utils.ts`

## Current Stack

| Category | Technology | Notes |
| :--- | :--- | :--- |
| Framework | React 19 | Function components |
| Build Tool | Vite 7 | SPA build/dev |
| Language | TypeScript 5 | Strict mode |
| Styling | Tailwind CSS v4 | Utility-first styles |
| UI primitives | shadcn-style local components | In `components/ui/*` |
| Data model | Static/local content | No TanStack Query by default |
| Routing | Section anchors/direct links | No TanStack Router by default |
| State management | Local component state | No Zustand by default |

## Development Commands

```bash
# Run landing in dev mode
make run-landing

# Or package-local commands
pnpm --filter @cofy-x/deck-landing run dev
pnpm --filter @cofy-x/deck-landing run typecheck
pnpm --filter @cofy-x/deck-landing run lint
pnpm --filter @cofy-x/deck-landing run build
```

## Content and i18n Pattern

- Keep copy, labels, and section text centralized in `src/content/site-content.ts`.
- Keep `App.tsx` focused on layout/composition instead of embedding large literal copy blocks.
- When extending locales, update the content map first, then wire rendering logic.

## Common Pitfalls

- Do not introduce TanStack Router, TanStack Query, or Zustand unless new requirements justify them.
- Do not pull in backend/API client dependencies for static sections.
- Keep animations lightweight and ensure mobile rendering remains stable.
- Store landing-specific assets in `apps/landing/public` and reference them with stable absolute paths.

## Read Next

- `.x/guide-frontend.md`
- `apps/landing/README.md`
- `docs/design/landing-deploy.md`
