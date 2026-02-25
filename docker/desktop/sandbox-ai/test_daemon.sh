#!/bin/bash

# --- Configuration ---
export CONTAINER_NAME="deck-desktop-sandbox-ai"
export SSH_PORT=22220
export WS_URL="ws://localhost:22222/ws"
export DECK_DAEMON_TOKEN=${DECK_DAEMON_TOKEN:-"your-secret-token"}
export CONCURRENCY=20

SCRIPT_DIR=$(dirname "$0")

echo "🚀 Starting Full Spectrum Stress Test for Deck Daemon..."

# 1. SSH Test (Non-PTY path)
echo "----------------------------------------------------"
echo "📦 Phase 1: SSH Concurrency Test..."
for i in $(seq 1 $CONCURRENCY); do
    sshpass -p "sandbox-ssh" ssh -p $SSH_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        deck@localhost "exit" > /dev/null 2>&1 &
done
wait
echo "✅ SSH Phase Complete."

# 2. Web Terminal Test (PTY path)
echo "----------------------------------------------------"
echo "📦 Phase 2: Web Terminal WebSocket Test..."
if [ -f "$SCRIPT_DIR/test_ws_stress.py" ]; then
    python3 "$SCRIPT_DIR/test_ws_stress.py"
else
    echo "❌ Error: test_ws_stress.py not found!"
    exit 1
fi
echo "✅ Web Phase Complete. Waiting 5s for logs to flush..."
sleep 5

# 3. Final Audit
echo "----------------------------------------------------"
echo "📊 Final Log Audit (Scanning last 2 minutes):"

LOG_DATA=$(docker logs --since 2m $CONTAINER_NAME 2>&1)

SSH_SUCCESS=$(echo "$LOG_DATA" | grep -c "SSH-.*Session closed")

WS_CLEAN_EXIT=$(echo "$LOG_DATA" | grep -c "Web terminal session finished successfully")
WS_WATCHDOG_EXIT=$(echo "$LOG_DATA" | grep -c "Web terminal session ended: signal: killed")
WS_TOTAL_HANDLED=$((WS_CLEAN_EXIT + WS_WATCHDOG_EXIT))

# Check both PTY and Non-PTY reaped logs
REAPED_LOGS=$(echo "$LOG_DATA" | grep -c "reaped by the global PID 1 supervisor")
# Important: This should be 0
LEAKED_ERRORS=$(echo "$LOG_DATA" | grep -c "no child processes")

echo "✔️  SSH Successful Sessions: $SSH_SUCCESS / $CONCURRENCY"
echo "✔️  Web Sessions Handled: $WS_TOTAL_HANDLED / $CONCURRENCY (Clean: $WS_CLEAN_EXIT, Watchdog: $WS_WATCHDOG_EXIT)"
echo "🔍 Reaping Races Handled: $REAPED_LOGS"
echo "❌ Leaked 'no child processes' Errors: $LEAKED_ERRORS"

if [ "$LEAKED_ERRORS" -eq 0 ] && [ "$WS_TOTAL_HANDLED" -ge "$CONCURRENCY" ]; then
    echo -e "\n🏆 FINAL VERDICT: PRODUCTION READY"
else
    echo -e "\n⚠️  FINAL VERDICT: ISSUES DETECTED - CHECK LOGS"
    exit 1
fi