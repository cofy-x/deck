# Frontend Development Guide

Shared conventions for TanStack-based React/TypeScript frontend applications in the deck monorepo.

**Applies to:** `apps/client`, `apps/dashboard`

For landing-site conventions, use [guide-landing.md](./guide-landing.md).

## Applicability Matrix

| Rule Area | `apps/client` | `apps/dashboard` | `apps/landing` |
| :--- | :--- | :--- | :--- |
| TanStack Router | Required | Required | Not used by default |
| TanStack Query | Required | Required | Not used by default |
| Zustand stores | Required for app state | Used for selected UI state | Avoid by default (prefer local component state) |
| Generated API client integration | OpenCode SDK + daemon SDK | Orval + Axios | Not used by default |
| Dedicated guide | [guide-client.md](./guide-client.md) | [guide-dashboard.md](./guide-dashboard.md) | [guide-landing.md](./guide-landing.md) |

## Tech Stack

Shared stack for `apps/client` and `apps/dashboard`:

| Category | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| Framework | React | v19 | Function components only |
| Build Tool | Vite | v7 | Dev server and bundler |
| Language | TypeScript | v5 | Strict mode enabled |
| Routing | TanStack Router | v1 | Type-safe, file-based routing |
| State (Server) | TanStack Query | v5 | Server state, caching, data fetching |
| State (Client) | Zustand | v5 | Persistent UI state (sidebar, theme, dialogs) |
| Styling | Tailwind CSS | v4 | Utility-first styling |
| UI Library | shadcn/ui | Latest | Headless UI + Tailwind (copy-paste) |
| Icons | Lucide React | Latest | Standard icon set |
| Forms | React Hook Form | v7 | Form state management |
| Validation | Zod | v4 | Schema validation (forms + API) |

## Component Architecture

The structure below describes TanStack-based frontend apps (`client` and `dashboard`).

### Structure

```
src/
├── components/
│   ├── ui/             # shadcn/ui primitives (Button, Dialog, etc.)
│   └── <feature>/      # Feature-specific components
├── hooks/              # Custom React hooks
├── routes/             # TanStack Router file-based routes
├── stores/             # Zustand stores
├── lib/                # Utilities (cn(), constants, API clients)
└── styles/             # CSS files (if any)
```

### Rules

- **Functional only** — No class components.
- **shadcn/ui first** — Never write basic UI (Button, Input, Dialog) from scratch. Use:
  ```sh
  pnpm dlx shadcn@latest add [component-name]
  ```
- **Customization** — Modify generated shadcn source in `components/ui/` directly. Do not override via external CSS.

## Styling Standards

- Use **Tailwind CSS v4** utility classes exclusively.
- Use CSS variables from `index.css` (`@theme`) for consistent branding.
- Use the `cn()` utility for conditional class merging:
  ```ts
  import { cn } from '@/lib/utils';
  cn('base-class', condition && 'conditional-class');
  ```

## State Management

This section applies to `client` and `dashboard`.

```mermaid
sequenceDiagram
    participant Backend as Backend/API
    participant TQ as TanStack Query
    participant Component as React Component
    participant Zustand as Zustand Store

    Backend->>TQ: Fetch / mutate data
    TQ->>Component: Server state (cached)
    Zustand->>Component: UI state (sidebar, theme)
    Component->>TQ: Invalidate on mutation
```

- **Server state** → **TanStack Query** — For any data from backend/API.
- **Client UI state** → **Zustand** — For ephemeral UI state (sidebar toggle, user preferences, search input).
- Never use `useEffect` for backend data fetching. Use TanStack Query hooks.

## Type Safety

- **Routes** — In TanStack Router apps, all navigation must use `Link` or `useNavigate`.
- **Forms** — Use React Hook Form with Zod resolver.
- **API clients** — Use generated clients (Orval for dashboard, SDK for client).

## Content Rendering (Markdown)

When an app requires markdown rendering:

- **Stack:** `react-markdown` + `remark-gfm` + `shiki`
- **Styling:** Use `@tailwindcss/typography` (`prose` class) for document flow.
- **Code highlighting:** Use `shiki` with VS Code themes (e.g., `github-dark`).

## App-Specific Differences

| Feature | `apps/client` | `apps/dashboard` | `apps/landing` |
| :--- | :--- | :--- | :--- |
| Shell | Tauri v2 (Desktop) | Browser SPA | Browser SPA |
| Routing | TanStack Router | TanStack Router | Section anchors / direct links |
| Server data model | TanStack Query + OpenCode SDK | TanStack Query + Axios/Orval | Static/local content by default |
| Client state model | Zustand stores + query cache | Zustand + query cache | Local component state by default |
| Primary purpose | Desktop cockpit and sandbox operations | Admin and API operations | Marketing and product communication |

For app-specific details, see [guide-client.md](./guide-client.md), [guide-dashboard.md](./guide-dashboard.md), and [guide-landing.md](./guide-landing.md).
