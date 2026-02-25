#!/usr/bin/env bash
set -euo pipefail

BRIDGE_REF="${BRIDGE_REF:-main}"
BRIDGE_REPO="${BRIDGE_REPO:-https://github.com/cofy-x/deck.git}"
BRIDGE_INSTALL_DIR="${BRIDGE_INSTALL_DIR:-$HOME/.deck/pilot/bridge}"
BRIDGE_BIN_DIR="${BRIDGE_BIN_DIR:-$HOME/.local/bin}"
BRIDGE_INSTALL_METHOD="${BRIDGE_INSTALL_METHOD:-npm}"

usage() {
  cat <<'EOF'
Pilot bridge installer (WhatsApp-first)

Environment variables:
  BRIDGE_INSTALL_DIR  Install directory (default: ~/.deck/pilot/bridge)
  BRIDGE_REPO         Git repo (default: https://github.com/cofy-x/deck.git)
  BRIDGE_REF          Git ref/branch (default: main)
  BRIDGE_BIN_DIR      Bin directory for pilot-bridge shim (default: ~/.local/bin)
  BRIDGE_INSTALL_METHOD  Install method: npm|git (default: npm)

Example:
  BRIDGE_INSTALL_DIR=~/pilot-bridge curl -fsSL https://raw.githubusercontent.com/cofy-x/deck/main/hack/install-pilot-bridge.sh | bash
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing $1. Please install it and retry." >&2
    exit 1
  fi
}

require_bin node

if [[ "$BRIDGE_INSTALL_METHOD" == "npm" ]]; then
  echo "Installing pilot-bridge via npm..."
  npm install -g pilot-bridge
else
  require_bin git
  if ! command -v pnpm >/dev/null 2>&1; then
    if command -v corepack >/dev/null 2>&1; then
      corepack enable >/dev/null 2>&1 || true
      corepack prepare pnpm@10.27.0 --activate
    else
      echo "pnpm is required. Install pnpm or enable corepack, then retry." >&2
      exit 1
    fi
  fi

  if [[ -d "$BRIDGE_INSTALL_DIR/.git" ]]; then
    echo "Updating pilot-bridge source in $BRIDGE_INSTALL_DIR"
    git -C "$BRIDGE_INSTALL_DIR" fetch origin --prune
    if git -C "$BRIDGE_INSTALL_DIR" show-ref --verify --quiet "refs/remotes/origin/$BRIDGE_REF"; then
      git -C "$BRIDGE_INSTALL_DIR" checkout -B "$BRIDGE_REF" "origin/$BRIDGE_REF"
      git -C "$BRIDGE_INSTALL_DIR" pull --ff-only origin "$BRIDGE_REF"
    else
      git -C "$BRIDGE_INSTALL_DIR" checkout -f
      git -C "$BRIDGE_INSTALL_DIR" pull --ff-only
    fi
  else
    echo "Cloning pilot-bridge source to $BRIDGE_INSTALL_DIR"
    mkdir -p "$BRIDGE_INSTALL_DIR"
    git clone --depth 1 "$BRIDGE_REPO" "$BRIDGE_INSTALL_DIR"
    if git -C "$BRIDGE_INSTALL_DIR" show-ref --verify --quiet "refs/remotes/origin/$BRIDGE_REF"; then
      git -C "$BRIDGE_INSTALL_DIR" checkout -B "$BRIDGE_REF" "origin/$BRIDGE_REF"
    fi
  fi

  if [[ ! -d "$BRIDGE_INSTALL_DIR/packages/pilot-bridge" ]]; then
    echo "pilot-bridge package not found on ref '$BRIDGE_REF'. Trying dev/main..." >&2
    git -C "$BRIDGE_INSTALL_DIR" fetch origin --prune
    if git -C "$BRIDGE_INSTALL_DIR" show-ref --verify --quiet refs/remotes/origin/dev; then
      git -C "$BRIDGE_INSTALL_DIR" checkout -B dev origin/dev
    elif git -C "$BRIDGE_INSTALL_DIR" show-ref --verify --quiet refs/remotes/origin/main; then
      git -C "$BRIDGE_INSTALL_DIR" checkout -B main origin/main
    fi
  fi

  if [[ ! -d "$BRIDGE_INSTALL_DIR/packages/pilot-bridge" ]]; then
    echo "pilot-bridge package not found after checkout. Aborting." >&2
    exit 1
  fi

  echo "Installing dependencies..."
  pnpm -C "$BRIDGE_INSTALL_DIR" install

  echo "Building pilot-bridge..."
  pnpm -C "$BRIDGE_INSTALL_DIR/packages/pilot-bridge" build

  ENV_PATH="$BRIDGE_INSTALL_DIR/packages/pilot-bridge/.env"
  ENV_EXAMPLE="$BRIDGE_INSTALL_DIR/packages/pilot-bridge/.env.example"
  if [[ ! -f "$ENV_PATH" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
      cp "$ENV_EXAMPLE" "$ENV_PATH"
      echo "Created $ENV_PATH"
    else
      cat <<EOF > "$ENV_PATH"
OPENCODE_URL=http://127.0.0.1:4096
OPENCODE_DIRECTORY=
WHATSAPP_AUTH_DIR=~/.deck/pilot/bridge/whatsapp
EOF
      echo "Created $ENV_PATH (minimal)"
    fi
  fi

  mkdir -p "$BRIDGE_BIN_DIR"
  cat <<EOF > "$BRIDGE_BIN_DIR/pilot-bridge"
#!/usr/bin/env bash
set -euo pipefail
node "$BRIDGE_INSTALL_DIR/packages/pilot-bridge/dist/cli.js" "$@"
EOF
  chmod 755 "$BRIDGE_BIN_DIR/pilot-bridge"
fi

if ! echo ":$PATH:" | grep -q ":$BRIDGE_BIN_DIR:"; then
  shell_name="$(basename "${SHELL:-}" 2>/dev/null || true)"
  case "$shell_name" in
    fish)
      echo "Add to PATH (fish): set -Ux PATH $BRIDGE_BIN_DIR \$PATH"
      ;;
    zsh)
      echo "Add to PATH (zsh):  echo 'export PATH=\"$BRIDGE_BIN_DIR:\$PATH\"' >> ~/.zshrc"
      ;;
    bash)
      echo "Add to PATH (bash): echo 'export PATH=\"$BRIDGE_BIN_DIR:\$PATH\"' >> ~/.bashrc"
      ;;
    *)
      echo "Add to PATH: export PATH=\"$BRIDGE_BIN_DIR:\$PATH\""
      ;;
  esac
fi

cat <<EOF

Pilot bridge installed.

Next steps:
1) Run pilot-bridge: pilot-bridge
2) Follow the guided setup + QR login

Pilot bridge will print a QR code during login and keep the session alive.
EOF
