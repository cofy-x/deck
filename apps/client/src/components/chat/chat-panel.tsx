/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Loader2,
  MessageSquare,
  FolderOpen,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import type { ChatInputSendPayload } from './chat-input';
import { ChatWelcome } from './chat-welcome';
import { PermissionDialog } from './permission-dialog';
import { QuestionDialog } from './question-dialog';
import { McpDialog } from './mcp-dialog';
import { FilePickerDialog } from './file-picker-dialog';
import { SessionErrorBanner } from './session-error-banner';
import { BrainStatusBadge } from '@/components/sandbox/status-badge';
import { ModelSelector } from '@/components/config/model-selector';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxState, useStartSandbox } from '@/hooks/use-sandbox';
import { useModelPreferencesStore } from '@/stores/model-preferences-store';
import { useViewerStore } from '@/stores/viewer-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useConfigStore } from '@/stores/config-store';
import { useActiveConnection } from '@/hooks/use-connection';
import {
  useSessionList,
  useSessionMessages,
  useCreateSession,
  useSendPrompt,
  useRevertSessionMessage,
  useAbortSession,
  useEventSubscription,
  useArchiveSession,
} from '@/hooks/use-session';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Session } from '@opencode-ai/sdk/v2/client';
import {
  buildRetryPayloadFromUserMessage,
  isRetryableUserMessage,
  type SessionMessageWithParts,
} from './retry-payload';
import { normalizeAssistantError } from '@/lib/session-error';
import { isAuthConnectionErrorMessage } from '@/lib/connection-errors';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Session list sidebar (inline)
// ---------------------------------------------------------------------------

function SessionListItem({
  session,
  title,
  isActive,
  onSelect,
  onArchive,
}: {
  session: Session;
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onArchive: () => void;
}) {
  const handleArchive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onArchive();
    },
    [onArchive],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/50',
        isActive && 'bg-muted',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{title}</span>
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeTime(session.time.created)}
        </span>
      </div>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={-1}
              onClick={handleArchive}
              className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted-foreground/20 group-hover:opacity-100"
            >
              <Archive className="h-3 w-3 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t('chat.archive_session')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </button>
  );
}

function hasMatchingAssistantErrorMessage(
  messages: SessionMessageWithParts[],
  targetError: { name: string; message: string },
): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.info.role !== 'assistant' || !message.info.error) continue;
    const normalized = normalizeAssistantError(message.info.error);
    if (
      normalized.name === targetError.name &&
      normalized.message === targetError.message
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main Chat Panel
// ---------------------------------------------------------------------------

export function ChatPanel() {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const brainStatus = useChatStore((s) => s.brainStatus);
  const setBrainStatus = useChatStore((s) => s.setBrainStatus);
  const pendingQuestions = useChatStore((s) => s.pendingQuestions);
  const removePendingQuestion = useChatStore((s) => s.removePendingQuestion);
  const sessionError = useChatStore((s) => s.sessionError);
  const setSessionError = useChatStore((s) => s.setSessionError);
  const setInputText = useChatStore((s) => s.setInputText);
  const sandboxStatus = useSandboxState(); // Use computed hook
  const sandboxErrorMessage = useSandboxStore((s) => s.errorMessage);
  const openSettings = useConfigStore((s) => s.openSettings);

  // Command-related store actions
  const setAgentSelectorOpen = useChatStore((s) => s.setAgentSelectorOpen);
  const setModelSelectorOpen = useChatStore((s) => s.setModelSelectorOpen);
  const setMcpDialogOpen = useChatStore((s) => s.setMcpDialogOpen);
  const setFilePickerOpen = useChatStore((s) => s.setFilePickerOpen);

  const isRunning = sandboxStatus === 'running';
  const canStartFromWelcome = sandboxStatus === 'idle' || sandboxStatus === 'error';
  const startSandbox = useStartSandbox();
  const { isRemote, profile } = useActiveConnection();
  const isRemoteAuthError =
    isRemote &&
    sandboxStatus === 'error' &&
    isAuthConnectionErrorMessage(sandboxErrorMessage);

  const currentDirectory = useProjectStore((s) => s.currentDirectory);
  const recentModels = useModelPreferencesStore((s) => s.recent);
  const expandPanel = useViewerStore((s) => s.expandPanel);
  const switchToDesktop = useViewerStore((s) => s.switchToDesktop);
  const switchToOpencode = useViewerStore((s) => s.switchToOpencode);
  const switchToTerminal = useViewerStore((s) => s.switchToTerminal);

  // Track previous directory to detect project switches
  const prevDirectoryRef = useRef(currentDirectory);
  const prevEffectiveSessionIdRef = useRef<string | null>(null);
  // Keep a temporary guard so a freshly-created session isn't overwritten
  // by a stale session list before query refresh completes.
  const pendingCreatedSessionRef = useRef<string | null>(null);

  const { data: sessions, isLoading: sessionsLoading } =
    useSessionList(currentDirectory);
  const visibleSessions = useMemo(
    () => sessions?.filter((s) => !s.time.archived) ?? [],
    [sessions],
  );
  const effectiveActiveSessionId =
    sessions === undefined
      ? null
      : visibleSessions.some((s) => s.id === activeSessionId)
        ? activeSessionId
        : null;
  const { data: messages, isLoading: messagesLoading } = useSessionMessages(
    effectiveActiveSessionId,
  );
  const currentMessages = useMemo(() => messages ?? [], [messages]);
  const createSession = useCreateSession();
  const sendPrompt = useSendPrompt();
  const revertSessionMessage = useRevertSessionMessage();
  const abortSession = useAbortSession();
  const archiveSession = useArchiveSession();
  const isSessionActive = brainStatus !== 'idle';
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(
    null,
  );

  // SSE event subscription - updates brain status and invalidates queries
  const { pendingPermissions, dismissPermission } = useEventSubscription(
    effectiveActiveSessionId,
    currentDirectory,
  );

  // Reset active session when project directory changes
  useEffect(() => {
    if (prevDirectoryRef.current !== currentDirectory) {
      prevDirectoryRef.current = currentDirectory;
      pendingCreatedSessionRef.current = null;
      setActiveSession(null);
    }
  }, [currentDirectory, setActiveSession]);

  // Keep active session aligned with visible session list.
  useEffect(() => {
    if (!sessions) return;
    if (visibleSessions.length === 0) {
      if (activeSessionId !== null) setActiveSession(null);
      return;
    }
    if (!activeSessionId) {
      setActiveSession(visibleSessions[0].id);
      return;
    }
    // Newly-created session may not appear in list immediately; keep focus.
    if (pendingCreatedSessionRef.current === activeSessionId) {
      return;
    }
    if (!visibleSessions.some((s) => s.id === activeSessionId)) {
      setActiveSession(visibleSessions[0].id);
    }
  }, [activeSessionId, sessions, visibleSessions, setActiveSession]);

  // Clear pending creation guard once the target session is visible.
  useEffect(() => {
    const pending = pendingCreatedSessionRef.current;
    if (!pending) return;
    if (visibleSessions.some((s) => s.id === pending)) {
      pendingCreatedSessionRef.current = null;
    }
  }, [visibleSessions]);

  // Session-scoped errors should not persist when switching sessions.
  useEffect(() => {
    if (prevEffectiveSessionIdRef.current !== effectiveActiveSessionId) {
      prevEffectiveSessionIdRef.current = effectiveActiveSessionId;
      if (sessionError) {
        setSessionError(null);
      }
    }
  }, [effectiveActiveSessionId, sessionError, setSessionError]);

  useEffect(() => {
    setRetryingMessageId(null);
  }, [effectiveActiveSessionId]);

  const handleCreateSession = useCallback(async () => {
    const session = await createSession.mutateAsync({
      directory: currentDirectory ?? undefined,
    });
    pendingCreatedSessionRef.current = session.id;
    setSessionError(null);
    setActiveSession(session.id);
  }, [createSession, setActiveSession, currentDirectory, setSessionError]);

  const getModelOverride = useCallback(() => {
    const activeRecent = recentModels[0];
    if (!activeRecent) return undefined;
    return {
      providerID: activeRecent.providerID,
      modelID: activeRecent.modelID,
    };
  }, [recentModels]);

  const handleSend = useCallback(
    (payload: ChatInputSendPayload) => {
      if (!effectiveActiveSessionId) return;

      // Optimistic UI status before server-side session.status events arrive.
      setBrainStatus('executing');
      sendPrompt.mutate({
        sessionId: effectiveActiveSessionId,
        prompt: payload.text,
        agent: payload.agent,
        model: getModelOverride(),
        attachments: payload.attachments,
        directory: currentDirectory ?? undefined,
      });
    },
    [
      effectiveActiveSessionId,
      sendPrompt,
      currentDirectory,
      getModelOverride,
      setBrainStatus,
    ],
  );

  const handleStop = useCallback(() => {
    if (!effectiveActiveSessionId || abortSession.isPending) return;
    // Optimistically switch UI back to idle so Send can be used immediately.
    // If the backend still emits running statuses, SSE will update this again.
    setBrainStatus('idle');
    abortSession.mutate(effectiveActiveSessionId, {
      onSuccess: () => setBrainStatus('idle'),
    });
  }, [effectiveActiveSessionId, abortSession, setBrainStatus]);

  const handleRetryMessage = useCallback(
    (message: SessionMessageWithParts) => {
      if (
        !effectiveActiveSessionId ||
        sendPrompt.isPending ||
        revertSessionMessage.isPending
      ) {
        return;
      }

      const payload = buildRetryPayloadFromUserMessage(message);
      if (!payload) return;

      setSessionError(null);
      setBrainStatus('executing');
      setRetryingMessageId(message.info.id);
      const modelOverride = getModelOverride();
      console.info('[ChatPanel] Retrying user message with revert+prompt', {
        sessionId: effectiveActiveSessionId,
        messageId: message.info.id,
        model: modelOverride ?? null,
        hasAttachments: !!payload.attachments?.length,
      });
      void (async () => {
        try {
          await revertSessionMessage.mutateAsync({
            sessionId: effectiveActiveSessionId,
            messageId: message.info.id,
            directory: currentDirectory ?? undefined,
          });
          await sendPrompt.mutateAsync({
            sessionId: effectiveActiveSessionId,
            messageId: message.info.id,
            prompt: payload.prompt,
            agent: payload.agent,
            model: modelOverride,
            attachments: payload.attachments,
            directory: currentDirectory ?? undefined,
          });
        } finally {
          setRetryingMessageId(null);
        }
      })();
    },
    [
      effectiveActiveSessionId,
      sendPrompt,
      revertSessionMessage,
      setSessionError,
      setBrainStatus,
      getModelOverride,
      currentDirectory,
    ],
  );

  const canRetryMessage = useCallback(
    (message: SessionMessageWithParts) =>
      !sendPrompt.isPending &&
      !revertSessionMessage.isPending &&
      isRetryableUserMessage(message),
    [sendPrompt.isPending, revertSessionMessage.isPending],
  );
  const showSessionErrorBanner = useMemo(() => {
    if (!sessionError) return false;
    return !hasMatchingAssistantErrorMessage(currentMessages, sessionError);
  }, [sessionError, currentMessages]);

  const handleClientCommand = useCallback(
    (commandName: string) => {
      switch (commandName) {
        case 'new':
          void handleCreateSession();
          break;
        case 'opencode':
          switchToOpencode();
          break;
        case 'desktop':
          switchToDesktop();
          break;
        case 'terminal':
          switchToTerminal();
          break;
        case 'agent':
          setAgentSelectorOpen(true);
          break;
        case 'model':
          setModelSelectorOpen(true);
          break;
        case 'mcp':
          setMcpDialogOpen(true);
          break;
        case 'open':
          setFilePickerOpen(true);
          break;
        default:
          console.info('[ChatPanel] Unhandled client command:', commandName);
          break;
      }
    },
    [
      handleCreateSession,
      switchToDesktop,
      switchToOpencode,
      switchToTerminal,
      setAgentSelectorOpen,
      setModelSelectorOpen,
      setMcpDialogOpen,
      setFilePickerOpen,
    ],
  );

  /** Insert selected file path into chat input. */
  const inputText = useChatStore((s) => s.inputText);
  const handleFilePickerSelect = useCallback(
    (filePath: string) => {
      const separator =
        inputText.length > 0 && !inputText.endsWith(' ') ? ' ' : '';
      setInputText(`${inputText}${separator}${filePath} `);
    },
    [inputText, setInputText],
  );

  const handleDismissError = useCallback(() => {
    setSessionError(null);
  }, [setSessionError]);

  const handleWelcomeStart = useCallback(() => {
    if (!canStartFromWelcome || startSandbox.isPending) return;
    // Welcome CTA implies "enter runnable environment", so reveal Desktop.
    expandPanel();
    switchToDesktop();
    startSandbox.mutate(undefined);
  }, [
    canStartFromWelcome,
    startSandbox,
    expandPanel,
    switchToDesktop,
  ]);

  // Show welcome screen when sandbox not running
  if (!isRunning) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-semibold">{t('chat.title')}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatWelcome
            isRemote={isRemote}
            isError={sandboxStatus === 'error'}
            isRemoteAuthError={isRemoteAuthError}
            connectionName={profile.name}
            errorMessage={sandboxErrorMessage}
            isStarting={startSandbox.isPending}
            startDisabled={!canStartFromWelcome}
            onStart={handleWelcomeStart}
            onOpenSettings={openSettings}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-semibold">{t('chat.title')}</span>
          {currentDirectory && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.5 cursor-default">
                    <FolderOpen className="h-3 w-3" />
                    {currentDirectory.split('/').pop()}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {currentDirectory}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <BrainStatusBadge status={brainStatus} />
          <ModelSelector />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleCreateSession()}
          disabled={createSession.isPending}
          className="h-7 px-2"
        >
          {createSession.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1 h-3.5 w-3.5" />
          )}
          {t('chat.new_session')}
        </Button>
      </div>

      {/* Session selector (compact list) */}
      {visibleSessions.length > 0 && (
        <div className="shrink-0">
          <div className="max-h-[106px] shrink-0 overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-0.5 p-2">
              {sessionsLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                visibleSessions.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    title={session.title?.trim() || t('chat.untitled_session')}
                    isActive={session.id === effectiveActiveSessionId}
                    onSelect={() => setActiveSession(session.id)}
                    onArchive={() =>
                      archiveSession.mutate({
                        sessionId: session.id,
                        archived: true,
                      })
                    }
                  />
                ))
              )}
            </div>
          </div>
          <Separator />
        </div>
      )}

      {/* Session error banner */}
      {showSessionErrorBanner && sessionError && (
        <div className="shrink-0 px-3 pt-2">
          <SessionErrorBanner
            error={sessionError}
            onDismiss={handleDismissError}
          />
        </div>
      )}

      {/* Messages area */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MessageList
          messages={currentMessages}
          isLoading={messagesLoading}
          onRetryMessage={handleRetryMessage}
          canRetryMessage={canRetryMessage}
          retryingMessageId={retryingMessageId}
        />
      </div>

      {/* Input */}
      <div className="shrink-0">
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          onClientCommand={handleClientCommand}
          disabled={!effectiveActiveSessionId}
          isSending={sendPrompt.isPending && isSessionActive}
          canStop={!!effectiveActiveSessionId && brainStatus !== 'idle'}
          isStopping={abortSession.isPending}
          directory={currentDirectory}
        />
      </div>

      {/* Permission dialog (modal overlay) */}
      <PermissionDialog
        permissions={pendingPermissions}
        onDismiss={dismissPermission}
      />

      {/* Question dialog (modal overlay) */}
      <QuestionDialog
        questions={pendingQuestions}
        onDismiss={removePendingQuestion}
      />

      {/* MCP dialog */}
      <McpDialog />

      {/* File picker dialog */}
      <FilePickerDialog onSelectFile={handleFilePickerSelect} />
    </div>
  );
}
