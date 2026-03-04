#!/usr/bin/env bash
set -eu

xfdesktop_dir="$HOME/.config/xfce4/desktop"
launcher_patterns_csv="${DECK_LAUNCHER_TRUST_FIX_PATTERNS:-/usr/share/applications/google-chrome.desktop}"
max_wait_seconds="${DECK_LAUNCHER_TRUST_FIX_WAIT_SECONDS:-120}"
watch_seconds="${DECK_LAUNCHER_TRUST_FIX_WATCH_SECONDS:-0}"
lock_file="/tmp/deck-fix-desktop-launchers.lock"

trim_spaces() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

ensure_trusted_in_cfg() {
  cfg="$1"
  section="$2"
  tmp_cfg="$(mktemp "${cfg}.tmp.XXXXXX")"

  awk -v section="$section" '
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

collect_system_launchers() {
  system_launchers=()
  declare -A seen_launchers=()
  IFS=',' read -r -a patterns <<< "$launcher_patterns_csv"

  shopt -s nullglob
  for raw_pattern in "${patterns[@]}"; do
    pattern="$(trim_spaces "$raw_pattern")"
    [ -n "$pattern" ] || continue

    for system_launcher in $pattern; do
      [ -f "$system_launcher" ] || continue
      if [ -z "${seen_launchers[$system_launcher]+x}" ]; then
        seen_launchers["$system_launcher"]=1
        system_launchers+=("$system_launcher")
      fi
    done
  done
  shopt -u nullglob
}

apply_fix_once() {
  mkdir -p "$HOME/Desktop" "$xfdesktop_dir"

  collect_system_launchers
  launchers=()

  for system_launcher in "${system_launchers[@]}"; do
    launcher="$HOME/Desktop/$(basename "$system_launcher")"

    if [ ! -f "$launcher" ]; then
      cp "$system_launcher" "$launcher"
    fi

    chmod 755 "$launcher"
    launchers+=("$launcher")
  done

  if [ "${#launchers[@]}" -eq 0 ]; then
    return 0
  fi

  chmod go-w "$HOME" "$HOME/Desktop" 2>/dev/null || true

  if command -v gio >/dev/null 2>&1; then
    for launcher in "${launchers[@]}"; do
      gio set "$launcher" metadata::trusted true 2>/dev/null || true
      if command -v sha256sum >/dev/null 2>&1; then
        launcher_checksum="$(sha256sum "$launcher" | awk '{print $1}')"
        if [ -n "$launcher_checksum" ]; then
          gio set -t string "$launcher" metadata::xfce-exe-checksum "$launcher_checksum" 2>/dev/null || true
        fi
      fi
    done
  fi

  found_section=0
  attempts=$((max_wait_seconds + 1))
  for _ in $(seq 1 "$attempts"); do
    normalize_latest_symlink

    for cfg in "$xfdesktop_dir"/icons.screen[0-9]*.rc; do
      [ -f "$cfg" ] || continue

      for launcher in "${launchers[@]}"; do
        launcher_section="[$launcher]"
        grep -qF "$launcher_section" "$cfg" || continue
        found_section=1
        ensure_trusted_in_cfg "$cfg" "$launcher_section"
      done
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
    DECK_LAUNCHER_TRUST_FIX_WAIT_SECONDS=0 apply_fix_once
  done
fi
