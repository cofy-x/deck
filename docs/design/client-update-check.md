# Client Update Check Design (apps/client)

This document describes the update notification feature in the Deck desktop
client and outlines the upgrade path to in-app auto-update.

## Scope

- Check for new releases via the GitHub Releases API.
- Notify users when a newer version is available.
- Provide a one-click path to the download page.

Primary implementation files:

- `apps/client/src/lib/update-check.ts` — GitHub API fetch, semver comparison
- `apps/client/src/hooks/use-update-check.ts` — TanStack Query hook, toast trigger
- `apps/client/src/components/config/settings-sheet.tsx` — About section in Settings
- `apps/client/src/components/layout/cockpit-layout.tsx` — Hook mount point
- `apps/client/src/lib/constants.ts` — `UPDATE_DISMISSED_KEY`
- `apps/client/src/i18n/locales/en.ts` / `zh.ts` — i18n strings

## Current Approach (v0.0.x — alpha)

### Why frontend-only, not Rust-side

The update check is a lightweight operation (HTTP GET + string comparison +
UI notification) that fits naturally in the frontend layer. No Rust-side logic
is needed because:

- No file-system writes or process replacement are involved.
- The Tauri webview stays alive while the window exists, so JS timers work
  fine for periodic polling.
- Moving logic to Rust would add unnecessary IPC bridging complexity.

### Why manual download, not in-app auto-update

The Tauri updater plugin (`tauri-plugin-updater`) requires:

1. **Code-signed builds** — the CI currently produces unsigned DMGs.
2. **Update manifests** (`latest.json`) generated and hosted alongside
   release assets.
3. **Rust-side plugin registration** and `tauri.conf.json` updater config.

None of these prerequisites are in place yet. A simple "check and redirect"
pattern is sufficient for the alpha stage where release frequency is low and
the user base is small.

### How it works

1. On app mount, `useUpdateCheck()` fires a TanStack Query that calls the
   GitHub Releases API: `GET /repos/cofy-x/deck/releases?per_page=1`.
2. The response is compared against the running app version obtained from
   `getVersion()` (`@tauri-apps/api/app`, reads the version embedded at
   build time from `tauri.conf.json`).
3. If a newer version is found and the user has not dismissed it, a Sonner
   toast is shown with **Download** (opens release page in system browser)
   and **Dismiss** (saves version to `localStorage` to suppress future
   toasts for that version) actions.
4. The query re-runs every 4 hours (`refetchInterval`) with a 1-hour stale
   window.
5. The Settings sheet includes an **About** section showing the current
   version, a manual "Check for updates" button, and (when available) a
   badge linking to the new release.

### Version comparison

Custom semver comparison supporting pre-release suffixes:

```
0.0.1-alpha.1 < 0.0.1-alpha.2 < 0.0.1-beta.1 < 0.0.1
```

The CI release workflow overrides `tauri.conf.json` version at build time,
so production builds always carry the correct release version.

## Future: In-App Auto-Update

When the project reaches beta/stable and the following prerequisites are met,
the update mechanism should be upgraded to use `tauri-plugin-updater` for
seamless in-app updates:

### Prerequisites

- [ ] Apple Developer code signing configured in CI.
- [ ] CI generates Tauri update manifests (`latest.json`) alongside DMG
      assets in the GitHub release.
- [ ] Windows builds added (requires Authenticode signing for updater).
- [ ] `tauri-plugin-updater` added to `Cargo.toml` and registered in
      `lib.rs`.
- [ ] `tauri.conf.json` updater section configured with the endpoint URL.

### Migration steps

1. Add `tauri-plugin-updater` to `apps/client/src-tauri/Cargo.toml`.
2. Register the plugin in `apps/client/src-tauri/src/lib.rs`.
3. Add updater configuration to `apps/client/src-tauri/tauri.conf.json`.
4. Update `apps/client/src-tauri/capabilities/default.json` with updater
   permissions.
5. Update CI workflow (`.github/workflows/client-release.yml`) to:
   - Sign builds with Apple Developer certificate.
   - Generate and upload `latest.json` manifest.
6. Replace the frontend GitHub API check with the Tauri updater JS API
   (`@tauri-apps/plugin-updater`, already removed from `package.json` —
   re-add when ready).
7. Keep the Settings About section but wire it to the native updater
   progress instead of a browser redirect.

### Cleanup on migration

- Remove `apps/client/src/lib/update-check.ts` (GitHub API fetch logic).
- Remove `UPDATE_DISMISSED_KEY` from `constants.ts` (native updater handles
  this).
- Simplify `use-update-check.ts` to wrap the Tauri updater API.
