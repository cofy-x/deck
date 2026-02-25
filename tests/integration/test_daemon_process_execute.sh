#!/bin/bash

# Test script to verify the process/execute endpoint fix
# This script should be run in both Mac and containerized environments
# See docs/design/daemon-bugfix-process-execute-race.md for context.

echo "Testing /process/execute endpoint for race condition fix..."
echo ""

# Start daemon in background (if not already running)
# Uncomment if you need to start daemon:
# ./build/daemon &
# DAEMON_PID=$!
# sleep 2

# Test 1: Simple command that should return exit code 0
echo "Test 1: ls -al (should return exitCode: 0)"
curl --silent --request POST \
  --url http://localhost:2280/process/execute \
  --header 'content-type: application/json' \
  --data '{
  "command": "ls -al",
  "cwd": "/"
}' | jq '.exitCode'

sleep 0.5

# Test 2: Command that fails (should return non-zero exit code)
echo "Test 2: ls /nonexistent (should return exitCode: 2)"
curl --silent --request POST \
  --url http://localhost:2280/process/execute \
  --header 'content-type: application/json' \
  --data '{
  "command": "ls /nonexistent",
  "cwd": "/"
}' | jq '.exitCode'

sleep 0.5

# Test 3: Quick command (stress test for race condition)
echo "Test 3: Running 10 quick commands to stress test race condition"
for i in {1..10}; do
  result=$(curl --silent --request POST \
    --url http://localhost:2280/process/execute \
    --header 'content-type: application/json' \
    --data "{
    \"command\": \"echo test $i\",
    \"cwd\": \"/\"
  }" | jq '.exitCode')

  if [ "$result" != "0" ]; then
    echo "  ❌ Test $i FAILED: exitCode = $result (expected 0)"
  else
    echo "  ✅ Test $i passed: exitCode = 0"
  fi
  sleep 0.1
done

if [ "$STRESS" = "1" ]; then
  echo ""
  echo "STRESS: Running 100 concurrent quick commands"
  tmp_dir="$(mktemp -d)"
  for i in {1..100}; do
    (
      curl --silent --request POST \
        --url http://localhost:2280/process/execute \
        --header 'content-type: application/json' \
        --data "{
        \"command\": \"echo stress $i\",
        \"cwd\": \"/\"
      }" | jq '.exitCode' > "${tmp_dir}/result_${i}.txt"
    ) &
  done
  wait

  fail_count=0
  for i in {1..100}; do
    result="$(cat "${tmp_dir}/result_${i}.txt")"
    if [ "$result" != "0" ]; then
      echo "  ❌ Stress $i FAILED: exitCode = $result (expected 0)"
      fail_count=$((fail_count + 1))
    fi
  done

  if [ "$fail_count" -eq 0 ]; then
    echo "  ✅ Stress passed: all 100 commands returned exitCode = 0"
  else
    echo "  ❌ Stress failed: $fail_count commands returned non-zero"
  fi

  rm -rf "$tmp_dir"
fi

echo ""
echo "Test complete!"
echo ""
echo "Expected results:"
echo "  - Test 1: exitCode = 0 (successful ls)"
echo "  - Test 2: exitCode = 2 (ls error)"
echo "  - Test 3: All 10 tests should return exitCode = 0"
if [ "$STRESS" = "1" ]; then
  echo "  - STRESS: All 100 commands should return exitCode = 0"
fi
echo ""
echo "If any test shows exitCode = -1, the race condition bug still exists."

# Cleanup
# kill $DAEMON_PID 2>/dev/null
