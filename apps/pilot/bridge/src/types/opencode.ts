/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GlobalHealthResponse as SdkGlobalHealthResponse,
  Part,
  SessionCreateResponse as SdkSessionCreateResponse,
  SessionPromptResponse as SdkSessionPromptResponse,
} from '@opencode-ai/sdk/v2/client';

// ---------------------------------------------------------------------------
// OpenCode API response types
// ---------------------------------------------------------------------------

export type HealthResponse = SdkGlobalHealthResponse;
export type PromptResponsePart = Part;
export type PromptResponse = SdkSessionPromptResponse;
export type SessionCreateResponse = SdkSessionCreateResponse;
