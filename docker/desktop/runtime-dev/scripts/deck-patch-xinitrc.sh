#!/usr/bin/env bash
set -eu

xinitrc="/etc/xdg/xfce4/xinitrc"
marker="deck-fix-chrome-launcher"

if [ ! -f "$xinitrc" ]; then
  echo "xinitrc not found: $xinitrc" >&2
  exit 1
fi

if grep -q "$marker" "$xinitrc"; then
  exit 0
fi

tmp_xinitrc="$(mktemp /tmp/xinitrc.XXXXXX)"

awk 'BEGIN { inserted = 0 } /# check if we start xfce4-session with ck-launch-session/ && inserted == 0 {
  print "if [ -x /usr/local/bin/deck-fix-chrome-launcher ]; then"
  print "  DECK_CHROME_TRUST_FIX_WAIT_SECONDS=1 DECK_CHROME_TRUST_FIX_WATCH_SECONDS=300 /usr/local/bin/deck-fix-chrome-launcher >/tmp/deck-fix-chrome-launcher.log 2>&1 &"
  print "fi"
  print ""
  inserted = 1
}
{ print }' "$xinitrc" > "$tmp_xinitrc"

mv "$tmp_xinitrc" "$xinitrc"
chmod 0755 "$xinitrc"

if ! grep -q "$marker" "$xinitrc"; then
  echo "failed to patch xinitrc with launcher fix hook" >&2
  exit 1
fi
