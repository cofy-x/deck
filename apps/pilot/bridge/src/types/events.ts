/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Event as SdkEvent,
  EventMessagePartDelta,
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventPermissionAsked,
  EventSessionIdle,
  EventSessionStatus,
} from '@opencode-ai/sdk/v2/client';

// ---------------------------------------------------------------------------
// OpenCode event stream property types
// ---------------------------------------------------------------------------

export type BridgeEvent = SdkEvent;
export type MessageUpdatedProps = EventMessageUpdated['properties'];
export type MessageInfo = MessageUpdatedProps['info'];
type UserMessageInfo = Extract<MessageInfo, { role: 'user' }>;
export type MessageModelInfo = UserMessageInfo['model'];
export type MessagePartProps = EventMessagePartUpdated['properties'];
export type MessagePartDeltaProps = EventMessagePartDelta['properties'];
export interface MessagePartStreamProps {
  part: MessagePartProps['part'];
  delta?: string;
}
export type ToolPartState = Extract<MessagePartProps['part'], { type: 'tool' }>['state'];
export type SessionStatusProps = EventSessionStatus['properties'];
export type SessionIdleProps = EventSessionIdle['properties'];
export type PermissionProps = EventPermissionAsked['properties'];
