/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelName } from './config.js';

// ---------------------------------------------------------------------------
// Channel adapter interface - contract all adapters must satisfy
// ---------------------------------------------------------------------------

export interface AdapterCapabilities {
  progress: boolean;
  typing: boolean;
  file: boolean;
}

export interface Adapter {
  name: ChannelName;
  maxTextLength: number;
  capabilities: AdapterCapabilities;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendText(peerId: string, text: string): Promise<void>;
  sendTextProgress?: (
    peerId: string,
    text: string,
    options?: { messageId?: number },
  ) => Promise<{ messageId?: number }>;
  sendFile?: (
    peerId: string,
    filePath: string,
    caption?: string,
  ) => Promise<void>;
  sendTyping?: (peerId: string) => Promise<void>;
}
