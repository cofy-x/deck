import websocket
import threading
import time
import os
import sys

# Get config from env (passed by shell)
WS_URL = os.getenv("WS_URL", "ws://localhost:22222/ws")
TOKEN = os.getenv("DECK_DAEMON_TOKEN", "your-secret-token")
CONCURRENCY = int(os.getenv("CONCURRENCY", "20"))


def run_ws(client_id):
    try:
        # Create a direct connection for performance
        ws = websocket.create_connection(
            WS_URL,
            header={"X-Deck-Token": TOKEN},
            timeout=5
        )
        # Simulate interaction: wait for prompt, then exit
        ws.send("\nexit\n")
        # Ensure the exit command is processed
        time.sleep(0.5)
        ws.close()
    except Exception as e:
        # We use stderr for errors to keep stdout clean for the shell
        print(f"Client {client_id} Error: {e}", file=sys.stderr)


def main():
    threads = []
    print(f"📡 Injecting {CONCURRENCY} WebSocket sessions...")

    for i in range(CONCURRENCY):
        t = threading.Thread(target=run_ws, args=(i,))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
