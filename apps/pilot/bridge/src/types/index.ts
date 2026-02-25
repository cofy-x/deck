/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// Configuration types
export type {
  AccessPolicy,
  ChannelName,
  ChannelsConfig,
  Config,
  ConfigFile,
  DingTalkChannelConfig,
  DiscordChannelConfig,
  EmailChannelConfig,
  FeishuChannelConfig,
  ModelRef,
  MochatChannelConfig,
  PermissionMode,
  QqChannelConfig,
  SlackChannelConfig,
  TelegramChannelConfig,
  TelegramThinkingMode,
  WhatsAppAccountConfig,
  WhatsAppChannelConfig,
} from './config.js';

// Adapter types
export type { Adapter, AdapterCapabilities } from './adapter.js';

// Message types
export type {
  BridgeReporter,
  InboundMessage,
  MessageHandler,
  OutboundKind,
  SendTextFn,
  SendTextOptions,
} from './message.js';

// OpenCode API types
export type {
  HealthResponse,
  PromptResponse,
  PromptResponsePart,
  SessionCreateResponse,
} from './opencode.js';

// Event types
export type {
  BridgeEvent,
  MessagePartDeltaProps,
  MessageInfo,
  MessageModelInfo,
  MessagePartProps,
  MessagePartStreamProps,
  MessageUpdatedProps,
  PermissionProps,
  SessionIdleProps,
  SessionStatusProps,
  ToolPartState,
} from './events.js';

// Health types
export type {
  GroupsConfigResult,
  HealthHandlers,
  HealthSnapshot,
  SlackTokensResult,
  TelegramTokenResult,
} from './health.js';

// Bridge types
export type {
  AdapterConfigResult,
  BridgeDeps,
  BridgeInstance,
  EventSubscription,
  RunState,
  SessionModelMap,
} from './bridge.js';

// Run state types
export type {
  BaseRunState,
  GenericRunState,
  ReasoningPartTracker,
  RunLifecycleState,
  TelegramRunState,
  ToolStateTracker,
} from './run-state.js';

// JSON types
export type {
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from './json.js';
