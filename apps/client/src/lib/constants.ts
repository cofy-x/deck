/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// Port configuration for the sandbox container
// ---------------------------------------------------------------------------

export const PORTS = {
  /** OpenCode AI server */
  OPENCODE: 4096,
  /** VNC server (x11vnc) */
  VNC: 5901,
  /** noVNC web interface */
  NOVNC: 6080,
  /** Deck daemon REST API */
  DAEMON: 2280,
  /** SSH server */
  SSH: 22220,
  /** Web terminal (WebSocket) */
  WEB_TERMINAL: 22222,
} as const;

// ---------------------------------------------------------------------------
// Local sandbox URLs (default local profile)
// ---------------------------------------------------------------------------

export const LOCAL_OPENCODE_BASE_URL = `http://127.0.0.1:${PORTS.OPENCODE}`;
export const LOCAL_NOVNC_URL = `http://127.0.0.1:${PORTS.NOVNC}/vnc.html?autoconnect=true&resize=scale`;
export const LOCAL_DAEMON_BASE_URL = `http://127.0.0.1:${PORTS.DAEMON}`;
export const LOCAL_WEB_TERMINAL_URL = `http://127.0.0.1:${PORTS.WEB_TERMINAL}`;

// ---------------------------------------------------------------------------
// Container configuration
// ---------------------------------------------------------------------------

export const CONTAINER_NAME = 'deck-desktop-sandbox-ai';
export const DEFAULT_IMAGE = 'deck/desktop-sandbox-ai:latest';

// ---------------------------------------------------------------------------
// Language preference
// ---------------------------------------------------------------------------

export const LANGUAGE_PREF_KEY = 'deck.language';

// ---------------------------------------------------------------------------
// Display configuration
// ---------------------------------------------------------------------------

export const SANDBOX_RESOLUTION = {
  width: 1280,
  height: 720,
} as const;
