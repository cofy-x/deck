#!/usr/bin/env bash
set -eu

launcher="$HOME/Desktop/google-chrome.desktop"
system_launcher="/usr/share/applications/google-chrome.desktop"
xfdesktop_dir="$HOME/.config/xfce4/desktop"
launcher_section="[$launcher]"
max_wait_seconds="${DECK_CHROME_TRUST_FIX_WAIT_SECONDS:-120}"
watch_seconds="${DECK_CHROME_TRUST_FIX_WATCH_SECONDS:-0}"
lock_file="/tmp/deck-fix-chrome-launcher.lock"

ensure_trusted_in_cfg() {
  cfg="$1"
  tmp_cfg="$(mktemp "${cfg}.tmp.XXXXXX")"

  awk -v section="$launcher_section" '
    BEGIN {
      in_section = 0
      has_trusted = 0
    }

    $0 == section {
      in_section = 1
      has_trusted = 0
      print
      next
    }

    in_section && /^\[/ {
      if (!has_trusted) {
        print "trusted=true"
      }
      in_section = 0
    }

    in_section && $0 == "trusted=true" {
      has_trusted = 1
    }

    {
      print
    }

    END {
      if (in_section && !has_trusted) {
        print "trusted=true"
      }
    }
  ' "$cfg" > "$tmp_cfg" && mv "$tmp_cfg" "$cfg"
}

normalize_latest_symlink() {
  latest_cfg="$xfdesktop_dir/icons.screen.latest.rc"
  primary_cfg=""

  for cfg in "$xfdesktop_dir"/icons.screen[0-9]*.rc; do
    [ -f "$cfg" ] || continue
    primary_cfg="$cfg"
    break
  done

  [ -n "$primary_cfg" ] || return 0
  ln -sfn "$primary_cfg" "$latest_cfg"
}

apply_fix_once() {
  mkdir -p "$HOME/Desktop" "$xfdesktop_dir"

  if [ ! -f "$launcher" ] && [ -f "$system_launcher" ]; then
    cp "$system_launcher" "$launcher"
  fi

  if [ -f "$launcher" ]; then
    chmod 755 "$launcher"
  fi

  chmod go-w "$HOME" "$HOME/Desktop" 2>/dev/null || true

  if [ -f "$launcher" ] && command -v gio >/dev/null 2>&1; then
    gio set "$launcher" metadata::trusted true 2>/dev/null || true
    if command -v sha256sum >/dev/null 2>&1; then
      launcher_checksum="$(sha256sum "$launcher" | awk '{print $1}')"
      if [ -n "$launcher_checksum" ]; then
        gio set -t string "$launcher" metadata::xfce-exe-checksum "$launcher_checksum" 2>/dev/null || true
      fi
    fi
  fi

  found_section=0
  attempts=$((max_wait_seconds + 1))
  for _ in $(seq 1 "$attempts"); do
    normalize_latest_symlink

    for cfg in "$xfdesktop_dir"/icons.screen[0-9]*.rc; do
      [ -f "$cfg" ] || continue
      grep -qF "$launcher_section" "$cfg" || continue
      found_section=1
      ensure_trusted_in_cfg "$cfg"
    done

    if [ "$found_section" -eq 1 ]; then
      break
    fi

    sleep 1
  done
}

if command -v flock >/dev/null 2>&1; then
  exec 9>"$lock_file"
  flock -n 9 || exit 0
fi

apply_fix_once

if [ "$watch_seconds" -gt 0 ]; then
  for _ in $(seq 1 "$watch_seconds"); do
    sleep 1
    DECK_CHROME_TRUST_FIX_WAIT_SECONDS=0 apply_fix_once
  done
fi
