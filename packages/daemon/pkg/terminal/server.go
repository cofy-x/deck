package terminal

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"

	"github.com/cofy-x/deck/apps/daemon/pkg/common"
	common_consts "github.com/cofy-x/deck/packages/core-go/pkg/consts"
	"github.com/cofy-x/deck/packages/core-go/pkg/log"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// In production, token-based authentication handles security.
		return true
	},
}

type windowSize struct {
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

// genSessionID creates a unique hex string for tracing web terminal sessions.
func genSessionID() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "ws-unknown"
	}
	return "WS-" + hex.EncodeToString(b)
}

func StartTerminalServer(port int) error {
	// Prepare the embedded frontend files
	staticFS, err := fs.Sub(static, "static")
	if err != nil {
		return err
	}

	// Use a local Mux to avoid polluting the default global mux
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(staticFS)))
	mux.HandleFunc("/ws", handleWebSocket)

	addr := fmt.Sprintf(":%d", port)
	log.Printf("Starting terminal server on http://localhost%s", addr)

	return http.ListenAndServe(addr, mux)
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	sid := genSessionID()
	log.Infof("[%s] New WebSocket connection request from %s", sid, r.RemoteAddr)

	// 1. Authentication
	expectedToken := os.Getenv(common_consts.EnvDeckDaemonToken)
	if expectedToken != "" {
		token := r.Header.Get(common_consts.DaemonAuthHeader)
		if token != expectedToken {
			log.Warnf("[%s] Unauthorized connection attempt", sid)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}

	// 2. Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Errorf("[%s] Failed to upgrade connection: %v", sid, err)
		return
	}
	defer conn.Close()

	// 3. Lifecycle Setup
	ctx, cancel := context.WithCancel(context.Background())
	// No defer cancel() here to allow the Output loop to flush after SpawnTTY returns.

	decoder := NewUTF8Decoder()
	sizeCh := make(chan common.TTYSize, 1)

	// Pipes bridge the WebSocket (network) and SpawnTTY (file/process)
	stdInReader, stdInWriter := io.Pipe()
	stdOutReader, stdOutWriter := io.Pipe()

	// WS -> PTY (Input Loop)
	go func() {
		defer func() {
			log.Debugf("[%s] Closing WS-Input loop", sid)
			_ = stdInWriter.Close()
			cancel() // Trigger cleanup if client disconnects
		}()

		for {
			messageType, p, err := conn.ReadMessage()
			if err != nil {
				return
			}

			// Handle Terminal Resize messages
			if messageType == websocket.TextMessage {
				var size windowSize
				if err := json.Unmarshal(p, &size); err == nil {
					select {
					case sizeCh <- common.TTYSize{Height: int(size.Rows), Width: int(size.Cols)}:
					default:
						// Buffer full, dropping old resize to stay responsive
					}
					continue
				}
			}

			// Write binary/text data to PTY Stdin
			_, err = stdInWriter.Write(p)
			if err != nil {
				return
			}
		}
	}()

	// PTY -> WS (Output Loop)
	go func() {
		defer func() {
			log.Debugf("[%s] Closing WS-Output loop", sid)
			_ = stdOutReader.Close()
			cancel()
		}()

		buf := make([]byte, 4096)
		for {
			n, err := stdOutReader.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Debugf("[%s] PTY output read error: %v", sid, err)
				}
				return
			}

			// Decodes UTF-8 and handles fragmented multi-byte characters
			decoded := decoder.Write(buf[:n])
			err = conn.WriteMessage(websocket.TextMessage, []byte(decoded))
			if err != nil {
				log.Warnf("[%s] WebSocket write failed: %v", sid, err)
				return
			}
		}
	}()

	// 4. Start PTY Shell
	log.Infof("[%s] Spawning shell for web terminal", sid)
	err = common.SpawnTTY(common.SpawnTTYOptions{
		Context:   ctx,
		SessionID: sid,
		Dir:       os.Getenv("HOME"),
		StdIn:     stdInReader,
		StdOut:    stdOutWriter,
		Term:      "xterm-256color",
		SizeCh:    sizeCh,
	})

	// 5. Cleanup and Flush
	// Closing the writer sends EOF to the Output Loop reader,
	// ensuring any remaining data in the pipe is sent before exiting.
	_ = stdOutWriter.Close()
	cancel()

	if err != nil {
		log.Debugf("[%s] Web terminal session ended: %v", sid, err)
	} else {
		log.Infof("[%s] Web terminal session finished successfully", sid)
	}
}
