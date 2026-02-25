/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Session,
  Part,
  ToolPart,
  Event,
  EventSessionError,
  OpencodeClient,
  SessionPromptResponse,
  FilePartInput,
  TextPartInput,
  PermissionRequest,
  QuestionAnswer,
} from '@opencode-ai/sdk/v2/client';
import { toast } from 'sonner';

import { unwrap } from '@/lib/opencode';
import { buildInlinedAttachmentText } from '@/lib/inlined-attachment';
import { detectComputerUseInvocation } from '@/lib/computer-use';
import {
  isUnsupportedMediaTypeMessage,
  normalizeEventSessionError,
  normalizeSessionError,
} from '@/lib/session-error';
import {
  type MessageWithParts,
  type PendingPartDelta,
  mergePartPreferNonRegressingText,
  mergeMessagesPreferNonRegressingText,
  mergeDeltaWithFallback,
  applyPendingDeltas,
  compactPendingDeltas,
} from '@/lib/stream-delta-merge';
import {
  pushSseDebugEntry,
  pushSseTraceOnlyEntry,
  resetTraceState,
} from '@/lib/sse-trace';
import {
  shouldLogSseEvent,
  summarizeSseEventJson,
  summarizeSseEventCompact,
} from '@/lib/sse-event-summary';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { useViewerStore } from '@/stores/viewer-store';
import { useOpenCodeClient } from '@/hooks/use-opencode-client';
import { useConnectionScope } from '@/hooks/use-connection';
import { CONFIG_KEYS } from '@/hooks/use-config';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const SESSION_KEYS = {
  all: (scope: string) => ['sessions', scope] as const,
  list: (scope: string, directory?: string) =>
    directory
      ? (['sessions', scope, 'list', directory] as const)
      : (['sessions', scope, 'list'] as const),
  messages: (scope: string, sessionId: string) =>
    ['sessions', scope, 'messages', sessionId] as const,
  children: (scope: string, sessionId: string) =>
    ['sessions', scope, 'children', sessionId] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type { MessageWithParts, PendingPartDelta } from '@/lib/stream-delta-merge';
type MessagePartDeltaEvent = Extract<Event, { type: 'message.part.delta' }>;
const MAX_PENDING_PART_DELTAS = 200;
const COMPUTER_USE_PROMPT_COOLDOWN_MS = 45_000;

const TEXTUAL_MIME_PREFIXES = ['text/'];
const TEXTUAL_MIME_EXACT = new Set([
  'application/json',
  'application/xml',
  'application/yaml',
  'application/x-yaml',
  'application/javascript',
  'application/x-javascript',
]);
const MAX_INLINED_ATTACHMENT_TEXT_CHARS = 200_000;

function isToolPart(part: Part): part is ToolPart {
  return part.type === 'tool';
}

function isTextualMime(mime: string): boolean {
  if (TEXTUAL_MIME_EXACT.has(mime)) return true;
  return TEXTUAL_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

function decodeDataUriToText(dataUri: string): string | null {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/i.exec(
    dataUri,
  );
  if (!match?.[2]) return null;
  try {
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function syncProjectDirectoryFromEvent(worktree: string) {
  const directory = worktree.trim();
  if (directory.length === 0) return;
  const project = useProjectStore.getState();
  if (project.currentDirectory === directory) return;
  project.setDirectory(directory);
}

interface PreparedAttachmentParts {
  parts: Array<TextPartInput | FilePartInput>;
  convertedTextCount: number;
  passthroughFileCount: number;
}

function toInlinedAttachmentTextPart(
  attachment: FilePartInput,
  decodedText: string,
): TextPartInput {
  return {
    type: 'text',
    text: buildInlinedAttachmentText({
      filename: attachment.filename,
      mime: attachment.mime,
      content: decodedText,
    }),
  };
}

function prepareAttachmentParts(
  attachments: FilePartInput[],
): PreparedAttachmentParts {
  const parts: Array<TextPartInput | FilePartInput> = [];
  let convertedTextCount = 0;
  let passthroughFileCount = 0;

  for (const attachment of attachments) {
    const mime = (attachment.mime ?? '').toLowerCase();
    if (!isTextualMime(mime)) {
      parts.push(attachment);
      passthroughFileCount += 1;
      continue;
    }
    const decodedText = decodeDataUriToText(attachment.url);
    if (
      decodedText === null ||
      decodedText.length > MAX_INLINED_ATTACHMENT_TEXT_CHARS
    ) {
      parts.push(attachment);
      passthroughFileCount += 1;
      continue;
    }
    parts.push(toInlinedAttachmentTextPart(attachment, decodedText));
    convertedTextCount += 1;
  }

  return { parts, convertedTextCount, passthroughFileCount };
}

function extractUnsupportedMessageFromPromptData(
  data: SessionPromptResponse,
): string | null {
  if (data.info.role !== 'assistant' || !data.info.error) return null;
  const message = data.info.error.data?.message;
  if (typeof message !== 'string') return null;
  return isUnsupportedMediaTypeMessage(message) ? message : null;
}

async function clearRetriedUserMessageParts(params: {
  client: OpencodeClient;
  sessionId: string;
  messageId: string;
  directory?: string;
}): Promise<void> {
  const { client, sessionId, messageId, directory } = params;

  const messageResult = await client.session.message({
    sessionID: sessionId,
    messageID: messageId,
    ...(directory ? { directory } : {}),
  });
  const messageData = unwrap(messageResult);
  if (!messageData || messageData.info.role !== 'user') return;

  const partIDs = [...new Set(messageData.parts.map((part) => part.id))];
  if (partIDs.length === 0) return;

  const results = await Promise.allSettled(
    partIDs.map(async (partID) => {
      const result = await client.part.delete({
        sessionID: sessionId,
        messageID: messageId,
        partID,
        ...(directory ? { directory } : {}),
      });
      // RequestResult may resolve with `error` instead of rejecting.
      unwrap(result);
      return partID;
    }),
  );

  const failedDeletes = results
    .map((result, index) => ({ result, partID: partIDs[index] }))
    .filter((entry) => entry.result.status === 'rejected');

  if (failedDeletes.length > 0) {
    const failedPartIDs = failedDeletes.map((entry) => entry.partID);
    const failedReasons = failedDeletes.map((entry) => {
      const reason = (entry.result as PromiseRejectedResult).reason;
      return reason instanceof Error ? reason.message : String(reason);
    });
    console.warn('[useSendPrompt] Failed to clear retry target parts', {
      sessionId,
      messageId,
      removedCount: partIDs.length - failedDeletes.length,
      failedCount: failedDeletes.length,
      failedPartIDs,
      failedReasons,
    });
    throw new Error('Failed to clear retry source message parts.');
  }

  const verifyResult = await client.session.message({
    sessionID: sessionId,
    messageID: messageId,
    ...(directory ? { directory } : {}),
  });
  const verifyMessage = unwrap(verifyResult);
  if (verifyMessage.info.role !== 'user') return;
  const remainingLegacyPartCount = verifyMessage.parts.filter((part) =>
    partIDs.includes(part.id),
  ).length;
  if (remainingLegacyPartCount > 0) {
    console.warn(
      '[useSendPrompt] Retry target still contains legacy parts after delete',
      {
        sessionId,
        messageId,
        remainingLegacyPartCount,
        requestedDeleteCount: partIDs.length,
      },
    );
    throw new Error('Retry source message still has legacy parts.');
  }

  console.info('[useSendPrompt] Cleared retry target message parts', {
    sessionId,
    messageId,
    removedCount: partIDs.length,
  });
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List sessions from the OpenCode server, optionally scoped to a directory.
 */
export function useSessionList(directory?: string | null) {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();
  const dir = directory ?? undefined;

  return useQuery({
    queryKey: SESSION_KEYS.list(scope, dir),
    queryFn: async (): Promise<Session[]> => {
      if (!client) return [];
      const result = await client.session.list({
        ...(dir ? { directory: dir } : {}),
        roots: true,
      });
      return unwrap(result) ?? [];
    },
    enabled: !!client,
  });
}

/**
 * Fetch messages + parts for a session.
 */
export function useSessionMessages(sessionId: string | null) {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();
  const qc = useQueryClient();

  return useQuery({
    queryKey: SESSION_KEYS.messages(scope, sessionId ?? ''),
    queryFn: async (): Promise<MessageWithParts[]> => {
      if (!client || !sessionId) return [];
      try {
        const result = await client.session.messages({
          sessionID: sessionId,
        });
        const data = unwrap(result);
        const normalized = Array.isArray(data) ? data : [];
        const previous = qc.getQueryData<MessageWithParts[]>(
          SESSION_KEYS.messages(scope, sessionId),
        );
        return mergeMessagesPreferNonRegressingText(previous, normalized);
      } catch (error) {
        console.error('[useSessionMessages] Failed to fetch messages:', error);
        return [];
      }
    },
    enabled: !!client && !!sessionId,
  });
}

/**
 * Create a new OpenCode session, optionally within a project directory.
 */
export function useCreateSession() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();

  return useMutation({
    mutationFn: async (input?: { directory?: string }): Promise<Session> => {
      if (!client) throw new Error('No client available');
      const result = await client.session.create({
        ...(input?.directory ? { directory: input.directory } : {}),
      });
      return unwrap(result);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SESSION_KEYS.list(scope) });
    },
    onError: (error) => {
      console.error('[useCreateSession] Failed to create session:', error);
    },
  });
}

/**
 * Input for sending a prompt. Supports optional agent, model override,
 * file attachments, and a working directory.
 */
export interface SendPromptInput {
  sessionId: string;
  /** Retry target: reuse/update an existing user message instead of creating a new one. */
  messageId?: string;
  prompt: string;
  agent?: string;
  model?: { providerID: string; modelID: string };
  attachments?: FilePartInput[];
  directory?: string;
}

/**
 * Send a prompt to an active session.
 */
export function useSendPrompt() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();

  return useMutation({
    mutationFn: async (input: SendPromptInput) => {
      if (!client) throw new Error('No client available');
      console.info(
        '[useSendPrompt] Sending prompt to session:',
        input.sessionId,
      );
      const promptText = input.prompt;

      if (input.messageId) {
        await clearRetriedUserMessageParts({
          client,
          sessionId: input.sessionId,
          messageId: input.messageId,
          directory: input.directory,
        });
      }

      const preparedAttachments = input.attachments?.length
        ? prepareAttachmentParts(input.attachments)
        : null;

      const baseParts: Array<TextPartInput | FilePartInput> = [
        { type: 'text', text: promptText },
      ];
      if (preparedAttachments?.parts.length) {
        baseParts.push(...preparedAttachments.parts);
      }

      if (preparedAttachments?.convertedTextCount) {
        console.info(
          '[useSendPrompt] Inlined textual attachments as text parts',
          {
            sessionId: input.sessionId,
            convertedTextCount: preparedAttachments.convertedTextCount,
            passthroughFileCount: preparedAttachments.passthroughFileCount,
          },
        );
      }

      try {
        const result = await client.session.prompt({
          sessionID: input.sessionId,
          ...(input.messageId ? { messageID: input.messageId } : {}),
          parts: baseParts,
          ...(input.agent ? { agent: input.agent } : {}),
          ...(input.model ? { model: input.model } : {}),
          ...(input.directory ? { directory: input.directory } : {}),
        });
        const data: SessionPromptResponse = unwrap(result);
        if (preparedAttachments?.passthroughFileCount) {
          const unsupported = extractUnsupportedMessageFromPromptData(data);
          if (unsupported) {
            console.warn(
              '[useSendPrompt] Prompt result indicates unsupported passthrough file parts',
              {
                sessionId: input.sessionId,
                unsupported,
                convertedTextCount: preparedAttachments.convertedTextCount,
                passthroughFileCount: preparedAttachments.passthroughFileCount,
              },
            );
          }
        }
        return data;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (preparedAttachments?.passthroughFileCount) {
          if (isUnsupportedMediaTypeMessage(errorMessage)) {
            console.warn(
              '[useSendPrompt] Provider rejected passthrough file parts after preprocessing',
              {
                sessionId: input.sessionId,
                convertedTextCount: preparedAttachments.convertedTextCount,
                passthroughFileCount: preparedAttachments.passthroughFileCount,
              },
            );
          }
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.info('[useSendPrompt] Prompt success', {
        sessionId: variables.sessionId,
        retryMessageId: variables.messageId ?? null,
        assistantMessageId: data.info.id,
        assistantParentId:
          data.info.role === 'assistant' ? data.info.parentID : null,
      });
      void qc.invalidateQueries({
        queryKey: SESSION_KEYS.messages(scope, variables.sessionId),
      });
      void qc.invalidateQueries({ queryKey: SESSION_KEYS.list(scope) });
    },
    onError: (error, variables) => {
      console.error(
        '[useSendPrompt] Failed to send prompt to session:',
        variables.sessionId,
        error,
      );
      const rawMessage = error instanceof Error ? error.message : String(error);
      const normalized = normalizeSessionError('UnknownError', rawMessage);
      toast.error(`${normalized.name}: ${normalized.message}`, {
        id: `session-error-${variables.sessionId}`,
      });
      // On error, immediately reset brain to idle
      useChatStore.getState().setBrainStatus('idle');
    },
  });
}

/**
 * Reply to a permission request.
 */
export function useReplyPermission() {
  const client = useOpenCodeClient();

  return useMutation({
    mutationFn: async (input: {
      requestID: string;
      reply: 'once' | 'always' | 'reject';
    }) => {
      if (!client) throw new Error('No client available');
      const result = await client.permission.reply({
        requestID: input.requestID,
        reply: input.reply,
      });
      return unwrap(result);
    },
    onError: (error) => {
      console.error('[useReplyPermission] Failed to reply:', error);
    },
  });
}

/**
 * Reply to or reject a question request from the AI.
 */
export function useQuestionReply() {
  const client = useOpenCodeClient();

  const replyMutation = useMutation({
    mutationFn: async (input: {
      requestId: string;
      sessionId: string;
      answers: QuestionAnswer[];
    }) => {
      if (!client) throw new Error('No client available');
      const result = await client.question.reply({
        requestID: input.requestId,
        answers: input.answers,
      });
      return unwrap(result);
    },
    onError: (error) => {
      console.error('[useQuestionReply] Failed to reply:', error);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (input: { requestId: string; sessionId: string }) => {
      if (!client) throw new Error('No client available');
      const result = await client.question.reject({
        requestID: input.requestId,
      });
      return unwrap(result);
    },
    onError: (error) => {
      console.error('[useQuestionReply] Failed to reject:', error);
    },
  });

  return useMemo(
    () => ({
      reply: replyMutation.mutate,
      reject: rejectMutation.mutate,
      isPending: replyMutation.isPending || rejectMutation.isPending,
    }),
    [replyMutation, rejectMutation],
  );
}

/**
 * Abort an active session.
 */
export function useAbortSession() {
  const client = useOpenCodeClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!client) throw new Error('No client available');
      const result = await client.session.abort({ sessionID: sessionId });
      return unwrap(result);
    },
    onError: (error) => {
      console.error('[useAbortSession] Failed to abort:', error);
    },
  });
}

/**
 * Revert a session to a specific message before retrying.
 */
export function useRevertSessionMessage() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();

  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      messageId: string;
      directory?: string;
    }) => {
      if (!client) throw new Error('No client available');
      const result = await client.session.revert({
        sessionID: input.sessionId,
        messageID: input.messageId,
        ...(input.directory ? { directory: input.directory } : {}),
      });
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: SESSION_KEYS.messages(scope, variables.sessionId),
      });
    },
    onError: (error, variables) => {
      console.error(
        '[useRevertSessionMessage] Failed to revert session:',
        variables.sessionId,
        variables.messageId,
        error,
      );
    },
  });
}

/**
 * Archive (or unarchive) a session.
 * Archives by setting `time.archived` to current timestamp.
 */
export function useArchiveSession() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();

  return useMutation({
    mutationFn: async (input: { sessionId: string; archived: boolean }) => {
      if (!client) throw new Error('No client available');
      const result = await client.session.update({
        sessionID: input.sessionId,
        time: { archived: input.archived ? Date.now() : 0 },
      });
      return unwrap(result);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SESSION_KEYS.list(scope) });
    },
    onError: (error) => {
      console.error('[useArchiveSession] Failed:', error);
    },
  });
}

/**
 * Fetch child sessions (subagent sessions) for a parent session.
 * Used to display the internal workflow of subagent calls.
 */
export function useSessionChildren(
  sessionId: string | null,
  directory?: string | null,
) {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();
  const dir = directory ?? undefined;

  return useQuery({
    queryKey: [...SESSION_KEYS.children(scope, sessionId ?? ''), dir ?? ''] as const,
    queryFn: async (): Promise<Session[]> => {
      if (!client || !sessionId) return [];
      try {
        const result = await client.session.children({
          sessionID: sessionId,
          ...(dir ? { directory: dir } : {}),
        });
        const data = unwrap(result);
        if (Array.isArray(data) && data.length > 0) return data;

        // Fallback: some backends may not populate children endpoint reliably.
        // Query all sessions and filter by parentID.
        const listResult = await client.session.list({
          ...(dir ? { directory: dir } : {}),
        });
        const sessions = unwrap(listResult);
        if (!Array.isArray(sessions)) return [];
        return sessions.filter((session) => session.parentID === sessionId);
      } catch (error) {
        console.error('[useSessionChildren] Failed to fetch children:', error);
        return [];
      }
    },
    enabled: !!client && !!sessionId,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// SSE Event Subscription
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable error message from the session.error event.
 */
function extractErrorMessage(error: EventSessionError['properties']['error']): {
  name: string;
  message: string;
} {
  return normalizeEventSessionError(error);
}

/**
 * Hook that manages an SSE subscription to the OpenCode event stream.
 * Automatically invalidates queries and updates brain status on events.
 */
export function useEventSubscription(
  sessionId: string | null,
  directory?: string | null,
) {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();
  const qc = useQueryClient();
  const setBrainStatus = useChatStore((s) => s.setBrainStatus);
  const addPendingQuestion = useChatStore((s) => s.addPendingQuestion);
  const removePendingQuestion = useChatStore((s) => s.removePendingQuestion);
  const setSessionError = useChatStore((s) => s.setSessionError);
  const setTodos = useChatStore((s) => s.setTodos);
  const openContent = useViewerStore((s) => s.openContent);
  const switchToDesktop = useViewerStore((s) => s.switchToDesktop);
  const computerUsePromptedAtRef = useRef<Record<string, number>>({});
  const [pendingPermissions, setPendingPermissions] = useState<
    PermissionRequest[]
  >([]);

  // SSE subscription with auto-reconnection
  useEffect(() => {
    if (!client || !sessionId) {
      setBrainStatus('idle');
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const pendingPartDeltas = new Map<string, PendingPartDelta[]>();

    const subscribe = async () => {
      while (!cancelled) {
        try {
          const eventQuery = directory ? { directory } : undefined;
          console.info('[SSE] Subscribing to event stream...', {
            sessionId,
            directory: directory ?? null,
          });
          pushSseDebugEntry({
            url: '/event',
            summary: 'subscribe.start',
            requestBody: JSON.stringify({
              action: 'subscribe.start',
              sessionId,
              directory: directory ?? null,
            }),
          });
          const events = await client.event.subscribe(eventQuery, {
            signal: abortController.signal,
          });
          console.info('[SSE] Stream connected');
          pushSseDebugEntry({
            url: '/event',
            summary: 'subscribe.connected',
            responseBody: JSON.stringify({
              action: 'subscribe.connected',
              sessionId,
              directory: directory ?? null,
            }),
          });
          for await (const event of events.stream as AsyncIterable<Event>) {
            if (cancelled) break;
            if (shouldLogSseEvent(event)) {
              pushSseDebugEntry({
                url: '/event',
                summary: summarizeSseEventCompact(event),
                responseBody: summarizeSseEventJson(event),
              });
            }
            handleEvent(event);
          }
        } catch (error) {
          if (!cancelled) {
            console.warn('[SSE] Stream error, will reconnect:', error);
            pushSseDebugEntry({
              url: '/event',
              summary: 'stream.error',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Reconnect after a short delay unless cancelled
        if (!cancelled) {
          await new Promise((r) => setTimeout(r, 2_000));
        }
      }
    };

    const invalidateMessages = () => {
      void qc.invalidateQueries({
        queryKey: SESSION_KEYS.messages(scope, sessionId),
      });
    };

    const invalidateSessions = () => {
      void qc.invalidateQueries({ queryKey: SESSION_KEYS.list(scope) });
    };
    const invalidateChildren = () => {
      void qc.invalidateQueries({
        queryKey: SESSION_KEYS.children(scope, sessionId),
      });
    };

    const getPartDeltaKey = (
      targetSessionId: string,
      messageId: string,
      partId: string,
    ) => `${targetSessionId}:${messageId}:${partId}`;

    const queuePendingPartDelta = (
      targetSessionId: string,
      messageId: string,
      partId: string,
      field: string,
      delta: string,
    ) => {
      const key = getPartDeltaKey(targetSessionId, messageId, partId);
      const pending = pendingPartDeltas.get(key);
      const entry: PendingPartDelta = { field, delta };
      if (!pending) {
        pendingPartDeltas.set(key, [entry]);
        return;
      }
      pending.push(entry);
      if (pending.length > MAX_PENDING_PART_DELTAS) {
        pendingPartDeltas.set(
          key,
          compactPendingDeltas(pending, MAX_PENDING_PART_DELTAS),
        );
      }
    };

    const logDeltaBuffering = (
      targetSessionId: string,
      messageId: string,
      partId: string,
      field: string,
      delta: string,
      reasons: string[],
    ) => {
      pushSseDebugEntry({
        url: '/event',
        summary: `message.part.delta buffered part=${partId} reason=${reasons.join(',')}`,
        responseBody: JSON.stringify({
          type: 'message.part.delta.buffered',
          sessionID: targetSessionId,
          messageID: messageId,
          partID: partId,
          field,
          deltaLength: delta.length,
          reasons,
        }),
      });
    };

    const replayPendingPartDeltas = (
      targetSessionId: string,
      part: Part,
    ): Part => {
      const messageId = part.messageID;
      const partId = part.id;
      if (!messageId || !partId) return part;

      const key = getPartDeltaKey(targetSessionId, messageId, partId);
      const pending = pendingPartDeltas.get(key);
      if (!pending || pending.length === 0) return part;

      const { merged, remaining } = applyPendingDeltas(part, pending);

      if (remaining.length === 0) {
        pendingPartDeltas.delete(key);
      } else {
        pendingPartDeltas.set(key, remaining);
      }
      pushSseDebugEntry({
        url: '/event',
        summary: `message.part.delta replayed part=${partId} applied=${pending.length - remaining.length} remaining=${remaining.length}`,
        responseBody: JSON.stringify({
          type: 'message.part.delta.replayed',
          sessionID: targetSessionId,
          messageID: messageId,
          partID: partId,
          total: pending.length,
          applied: pending.length - remaining.length,
          remaining: remaining.length,
        }),
      });
      return merged;
    };

    const updatePartInCache = (targetSessionId: string, part: Part) => {
      const messageId = part.messageID;
      const partId = part.id;
      if (!messageId || !partId) {
        void qc.invalidateQueries({
          queryKey: SESSION_KEYS.messages(scope, targetSessionId),
        });
        return;
      }
      const partWithPendingDeltas = replayPendingPartDeltas(targetSessionId, part);

      let updated = false;
      qc.setQueryData<MessageWithParts[]>(
        SESSION_KEYS.messages(scope, targetSessionId),
        (prev) => {
          if (!prev || prev.length === 0) return prev;
          const next = prev.map((message) => {
            if (message.info.id !== messageId) return message;

            const index = message.parts.findIndex((p) => p.id === partId);
            if (index < 0) {
              updated = true;
              return {
                ...message,
                parts: [...message.parts, partWithPendingDeltas],
              };
            }

            const parts = [...message.parts];
            parts[index] = mergePartPreferNonRegressingText(
              parts[index],
              partWithPendingDeltas,
            );
            updated = true;
            return {
              ...message,
              parts,
            };
          });
          return updated ? next : prev;
        },
      );

      if (!updated) {
        void qc.invalidateQueries({
          queryKey: SESSION_KEYS.messages(scope, targetSessionId),
        });
      }
    };

    const updatePartDeltaInCache = (
      targetSessionId: string,
      event: MessagePartDeltaEvent,
    ) => {
      const { messageID, partID, field, delta } = event.properties;
      if (!messageID || !partID || !field) {
        void qc.invalidateQueries({
          queryKey: SESSION_KEYS.messages(scope, targetSessionId),
        });
        return;
      }
      if (!delta) return;

      let updated = false;
      let failReason: 'part-missing' | 'merge-failed' | undefined;

      qc.setQueryData<MessageWithParts[]>(
        SESSION_KEYS.messages(scope, targetSessionId),
        (prev) => {
          if (!prev || prev.length === 0) return prev;
          const next = prev.map((message) => {
            if (message.info.id !== messageID) return message;

            const index = message.parts.findIndex((part) => part.id === partID);
            if (index < 0) {
              failReason ??= 'part-missing';
              return message;
            }

            const merged = mergeDeltaWithFallback(
              message.parts[index],
              field,
              delta,
            );
            if (!merged) {
              failReason ??= 'merge-failed';
              return message;
            }

            const parts = [...message.parts];
            parts[index] = merged;
            updated = true;
            return {
              ...message,
              parts,
            };
          });
          return updated ? next : prev;
        },
      );

      if (!updated) {
        const reasons: string[] = [failReason ?? 'not-updated'];
        queuePendingPartDelta(targetSessionId, messageID, partID, field, delta);
        logDeltaBuffering(
          targetSessionId,
          messageID,
          partID,
          field,
          delta,
          reasons,
        );
        void qc.invalidateQueries({
          queryKey: SESSION_KEYS.messages(scope, targetSessionId),
        });
      }
    };

    const maybePromptDesktopForComputerUse = (
      targetSessionId: string,
      part: Part,
    ) => {
      if (targetSessionId !== sessionId) return;
      if (!isToolPart(part)) return;
      if (part.state.status !== 'running') return;

      const detection = detectComputerUseInvocation(
        part.tool,
        part.state.input,
      );
      if (!detection.detected) return;

      const viewerState = useViewerStore.getState();
      if (viewerState.mode === 'desktop') return;

      const now = Date.now();
      const lastPromptedAt =
        computerUsePromptedAtRef.current[targetSessionId] ?? 0;
      if (now - lastPromptedAt < COMPUTER_USE_PROMPT_COOLDOWN_MS) return;

      computerUsePromptedAtRef.current[targetSessionId] = now;
      const toolName = detection.displayName;

      toast.info(t('viewer.computer_use_detected_title'), {
        id: `computer-use-${targetSessionId}`,
        description: t('viewer.computer_use_detected_desc').replace(
          '{tool}',
          toolName,
        ),
        action: {
          label: t('viewer.open_desktop_action'),
          onClick: () => switchToDesktop(),
        },
      });
    };

    const handleEvent = (event: Event) => {
      switch (event.type) {
        // ---------------------------------------------------------------
        // Message events
        // ---------------------------------------------------------------
        case 'message.updated': {
          const targetSessionId = event.properties.info.sessionID;
          if (targetSessionId) {
            void qc.invalidateQueries({
              queryKey: SESSION_KEYS.messages(scope, targetSessionId),
            });
          } else {
            invalidateMessages();
          }
          break;
        }
        case 'message.part.updated': {
          const targetSessionId = event.properties.part.sessionID ?? sessionId;
          updatePartInCache(targetSessionId, event.properties.part);
          maybePromptDesktopForComputerUse(targetSessionId, event.properties.part);
          break;
        }
        case 'message.part.delta': {
          const targetSessionId = event.properties.sessionID;
          pushSseTraceOnlyEntry({
            url: '/event',
            summary: summarizeSseEventCompact(event),
            responseBody: summarizeSseEventJson(event),
          });
          if (targetSessionId) {
            updatePartDeltaInCache(targetSessionId, event);
          } else {
            updatePartDeltaInCache(sessionId, event);
          }
          break;
        }
        case 'message.removed': {
          if (event.properties.sessionID === sessionId) {
            invalidateMessages();
          }
          break;
        }
        case 'message.part.removed': {
          if (event.properties.sessionID === sessionId) {
            invalidateMessages();
          }
          break;
        }

        // ---------------------------------------------------------------
        // Session status events
        // ---------------------------------------------------------------
        case 'session.status': {
          if (event.properties.sessionID === sessionId) {
            const statusType = event.properties.status.type;
            if (statusType === 'idle') {
              pendingPartDeltas.clear();
              setBrainStatus('idle');
              invalidateMessages();
              invalidateSessions();
            } else if (statusType === 'retry') {
              setBrainStatus('retry');
            } else if (statusType === 'busy') {
              setBrainStatus('busy');
            } else {
              setBrainStatus('executing');
            }
          }
          break;
        }
        case 'session.idle': {
          if (event.properties.sessionID === sessionId) {
            pendingPartDeltas.clear();
            setBrainStatus('idle');
            invalidateMessages();
            invalidateSessions();
          }
          break;
        }
        case 'session.error': {
          const eventSessionId = event.properties.sessionID;
          if (eventSessionId === sessionId || !eventSessionId) {
            const errorObj = event.properties.error;
            const parsed = extractErrorMessage(errorObj);
            setSessionError({
              sessionID: eventSessionId,
              ...parsed,
            });
            toast.error(`${parsed.name}: ${parsed.message}`, {
              id: `session-error-${eventSessionId ?? 'global'}`,
            });
            setBrainStatus('idle');
            invalidateSessions();
          }
          break;
        }
        case 'session.compacted': {
          if (event.properties.sessionID === sessionId) {
            qc.removeQueries({
              queryKey: SESSION_KEYS.messages(scope, sessionId),
            });
            invalidateMessages();
            toast.info('Session compacted');
          }
          break;
        }

        // ---------------------------------------------------------------
        // Session CRUD
        // ---------------------------------------------------------------
        case 'session.created':
        case 'session.updated':
        case 'session.deleted': {
          invalidateSessions();
          if (event.properties.info.parentID === sessionId) {
            invalidateChildren();
          }
          break;
        }

        case 'project.updated': {
          syncProjectDirectoryFromEvent(event.properties.worktree);
          invalidateSessions();
          break;
        }

        // ---------------------------------------------------------------
        // Session diff (file changes)
        // ---------------------------------------------------------------
        case 'session.diff': {
          if (event.properties.sessionID === sessionId) {
            const diffs = event.properties.diff;
            if (diffs.length > 0) {
              const summary = diffs
                .map((d) => {
                  const prefix =
                    d.status === 'added'
                      ? '+'
                      : d.status === 'deleted'
                        ? '-'
                        : 'M';
                  return `${prefix} ${d.file} (+${d.additions} -${d.deletions})`;
                })
                .join('\n');
              openContent({
                type: 'diff',
                title: `${diffs.length} file${diffs.length > 1 ? 's' : ''} changed`,
                data: JSON.stringify(diffs),
                metadata: { sessionID: sessionId },
              });
              toast.info(
                `${diffs.length} file${diffs.length > 1 ? 's' : ''} changed`,
                { description: summary.slice(0, 200) },
              );
            }
          }
          break;
        }

        // ---------------------------------------------------------------
        // Permission events
        // ---------------------------------------------------------------
        case 'permission.asked': {
          setPendingPermissions((prev) => [...prev, event.properties]);
          break;
        }
        case 'permission.replied': {
          setPendingPermissions((prev) =>
            prev.filter((p) => p.id !== event.properties.requestID),
          );
          break;
        }

        // ---------------------------------------------------------------
        // Question events
        // ---------------------------------------------------------------
        case 'question.asked': {
          if (event.properties.sessionID === sessionId) {
            addPendingQuestion(event.properties);
          }
          break;
        }
        case 'question.replied': {
          if (event.properties.sessionID === sessionId) {
            removePendingQuestion(event.properties.requestID);
          }
          break;
        }
        case 'question.rejected': {
          if (event.properties.sessionID === sessionId) {
            removePendingQuestion(event.properties.requestID);
          }
          break;
        }

        // ---------------------------------------------------------------
        // Todo events
        // ---------------------------------------------------------------
        case 'todo.updated': {
          if (event.properties.sessionID === sessionId) {
            setTodos(event.properties.todos);
          }
          break;
        }

        // ---------------------------------------------------------------
        // Command execution (informational toast)
        // ---------------------------------------------------------------
        case 'command.executed': {
          if (event.properties.sessionID === sessionId) {
            invalidateMessages();
          }
          break;
        }

        // ---------------------------------------------------------------
        // File events (light tracking)
        // ---------------------------------------------------------------
        case 'file.edited': {
          // Informational - no action needed for now
          break;
        }

        // ---------------------------------------------------------------
        // Events we intentionally ignore in the Deck UI
        // ---------------------------------------------------------------
        case 'installation.updated':
        case 'installation.update-available':
        case 'server.instance.disposed':
        case 'server.connected':
        case 'global.disposed':
        case 'lsp.client.diagnostics':
        case 'lsp.updated':
        case 'file.watcher.updated':
        case 'tui.prompt.append':
        case 'tui.command.execute':
        case 'tui.toast.show':
        case 'tui.session.select':
        case 'mcp.tools.changed':
        case 'mcp.browser.open.failed':
        case 'vcs.branch.updated':
        case 'pty.created':
        case 'pty.updated':
        case 'pty.exited':
        case 'pty.deleted':
        case 'worktree.ready':
        case 'worktree.failed':
          break;

        default: {
          // Keep config cache fresh for newly-added server event types.
          void qc.invalidateQueries({ queryKey: CONFIG_KEYS.all(scope) });
          break;
        }
      }
    };

    void subscribe();

    return () => {
      cancelled = true;
      abortController.abort();
      resetTraceState();
      console.info('[SSE] Unsubscribing from event stream');
      pushSseDebugEntry({
        url: '/event',
        summary: 'subscribe.stopped',
        responseBody: JSON.stringify({
          action: 'subscribe.stopped',
          sessionId,
        }),
      });
    };
  }, [
    client,
    sessionId,
    directory,
    qc,
    setBrainStatus,
    addPendingQuestion,
    removePendingQuestion,
    setSessionError,
    setTodos,
    openContent,
    switchToDesktop,
    scope,
  ]);

  // Reset permissions when session changes
  useEffect(() => {
    setPendingPermissions([]);
  }, [sessionId]);

  const dismissPermission = useCallback((permissionId: string) => {
    setPendingPermissions((prev) => prev.filter((p) => p.id !== permissionId));
  }, []);

  return useMemo(
    () => ({
      pendingPermissions,
      dismissPermission,
    }),
    [pendingPermissions, dismissPermission],
  );
}
