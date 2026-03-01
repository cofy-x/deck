# Deck Desktop Runtime Dev (L2)

`desktop-runtime-dev` is the developer runtime layer for the desktop sandbox image stack.
It installs toolchains (Go, Node.js, Python tooling, Zsh) and defines deterministic Google Chrome behavior for XFCE/noVNC sessions.

## Why Chrome Needs Special Handling

Running Chrome inside a containerized XFCE desktop has three recurring issues:

1. Desktop launcher trust checks:
   XFCE may show `Untrusted application launcher` when `~/Desktop/google-chrome.desktop` is not trusted by metadata checks.
2. Keyring prompts:
   Chrome may ask to create a keyring in ephemeral/non-GNOME sessions, which blocks automation flows.
3. Container runtime constraints:
   Default Chrome startup behavior can introduce first-run prompts or unstable behavior in constrained `/dev/shm` environments.

## Chrome Handling in This Layer

### 1. Canonical Desktop Launcher

Launcher definition is maintained in `config/google-chrome.desktop` and installed to:

- `/home/${VNC_USER}/Desktop/google-chrome.desktop` (desktop icon target)
- `/usr/share/applications/google-chrome.desktop` (system launcher)

`Exec` includes:

- `--no-sandbox`
- `--test-type`
- `--disable-dev-shm-usage`
- `--no-first-run`
- `--no-default-browser-check`
- `--password-store=basic`

These flags reduce startup noise and make behavior predictable for containerized desktop automation.

### 2. Keyring-Safe Password Store Defaults

Two controls are applied to avoid keyring popups:

1. Launcher and shell alias use `--password-store=basic`.
2. Managed policy (`config/chrome-policy-managed.json`) sets:
   - `PasswordManagerEnabled=false`
   - `CredentialsEnableService=false`

Policy is installed to `/etc/opt/chrome/policies/managed/deck-sandbox.json`.

### 3. XFCE Launcher Trust Repair at Startup

`scripts/deck-fix-chrome-launcher.sh` ensures the desktop launcher is trusted by XFCE:

- Ensures launcher exists at `~/Desktop/google-chrome.desktop`.
- Sets executable bit (`chmod 755`).
- Applies `gio` metadata:
  - `metadata::trusted=true`
  - `metadata::xfce-exe-checksum=<sha256>`
- Updates `~/.config/xfce4/desktop/icons.screen*.rc` with `trusted=true` in the launcher section.

It is triggered by both:

- `/etc/xdg/autostart/deck-fix-chrome-launcher.desktop`
- An injected hook in `/etc/xdg/xfce4/xinitrc` (via `scripts/deck-patch-xinitrc.sh`)

Both hooks are intentional: they cover session timing races where XFCE generates icon state after initial startup.

### 4. Terminal Command Parity

`config/google-chrome-alias.sh` is installed as `/etc/profile.d/deck-google-chrome.sh` so shell-launched Chrome uses the same runtime-safe defaults.

## Source-of-Truth Files

- `Dockerfile`
- `config/google-chrome.desktop`
- `config/chrome-policy-managed.json`
- `config/deck-fix-chrome-launcher.desktop`
- `config/google-chrome-alias.sh`
- `scripts/deck-fix-chrome-launcher.sh`
- `scripts/deck-patch-xinitrc.sh`

## Verification in a Running Container

```bash
cat "$HOME/Desktop/google-chrome.desktop"
stat -c '%A %n' "$HOME/Desktop/google-chrome.desktop"
gio info -a metadata::trusted -a metadata::xfce-exe-checksum "$HOME/Desktop/google-chrome.desktop"
grep -R "trusted=true" "$HOME/.config/xfce4/desktop"/icons.screen*.rc
```

Expected:

- Desktop launcher has executable mode.
- `metadata::trusted` is `true`.
- At least one `icons.screen*.rc` entry for Chrome contains `trusted=true`.

## Troubleshooting

If `Untrusted application launcher` still appears:

1. Confirm you are running a freshly created container from the latest image (some workflows reuse old containers).
2. Check `/tmp/deck-fix-chrome-launcher.log` for startup hook errors.
3. Run `/usr/local/bin/deck-fix-chrome-launcher` manually inside the desktop session and re-check metadata.

If a keyring password dialog appears:

1. Verify the launcher `Exec` contains `--password-store=basic`.
2. Verify `/etc/opt/chrome/policies/managed/deck-sandbox.json` exists and contains password-manager disable policies.
