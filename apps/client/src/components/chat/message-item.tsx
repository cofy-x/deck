/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useState, useEffect } from 'react';
import {
  Loader2,
  FileText,
  GitBranch,
  RefreshCw,
  Layers,
  AlertTriangle,
  Coins,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  Brain,
  ChevronsUpDown,
} from 'lucide-react';
import type {
  AssistantMessage,
  Part,
  TextPart,
  ToolPart,
  ReasoningPart,
  FilePart as SDKFilePart,
  SubtaskPart,
  StepStartPart,
  StepFinishPart,
  RetryPart,
  CompactionPart,
  SnapshotPart,
  PatchPart,
  AgentPart,
} from '@opencode-ai/sdk/v2/client';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ToolCallLog } from './tool-call-log';
import { ReasoningBlock } from './reasoning-block';
import { MarkdownRenderer } from './markdown-renderer';
import { SubtaskWorkflow } from './subtask-workflow';
import { useViewerStore } from '@/stores/viewer-store';
import { cn } from '@/lib/utils';
import {
  extractInlinedAttachmentsFromText,
  type InlinedAttachment,
} from '@/lib/inlined-attachment';
import { normalizeAssistantError } from '@/lib/session-error';
import {
  getNormalizedUserMessageParts,
  type SessionMessageWithParts,
} from './retry-payload';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isTextPart(part: Part): part is TextPart {
  return part.type === 'text';
}

function isToolPart(part: Part): part is ToolPart {
  return part.type === 'tool';
}

function isReasoningPart(part: Part): part is ReasoningPart {
  return part.type === 'reasoning';
}

function isFilePart(part: Part): part is SDKFilePart {
  return part.type === 'file';
}

function isSubtaskPart(part: Part): part is SubtaskPart {
  return part.type === 'subtask';
}

function isStepStartPart(part: Part): part is StepStartPart {
  return part.type === 'step-start';
}

function isStepFinishPart(part: Part): part is StepFinishPart {
  return part.type === 'step-finish';
}

function isRetryPart(part: Part): part is RetryPart {
  return part.type === 'retry';
}

function isCompactionPart(part: Part): part is CompactionPart {
  return part.type === 'compaction';
}

function isSnapshotPart(part: Part): part is SnapshotPart {
  return part.type === 'snapshot';
}

function isPatchPart(part: Part): part is PatchPart {
  return part.type === 'patch';
}

function isAgentPart(part: Part): part is AgentPart {
  return part.type === 'agent';
}

type SubtaskLike = {
  agent: string;
  description: string;
  childSessionId?: string;
};

function inferLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'js':
      return 'javascript';
    case 'jsx':
      return 'jsx';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'sh':
      return 'bash';
    default:
      return 'plaintext';
  }
}

function inferLanguageFromMime(mime: string): string {
  const normalized = mime.toLowerCase();
  switch (normalized) {
    case 'text/markdown':
      return 'markdown';
    case 'application/json':
      return 'json';
    case 'application/yaml':
    case 'application/x-yaml':
      return 'yaml';
    case 'application/xml':
    case 'text/xml':
      return 'xml';
    case 'text/html':
      return 'html';
    case 'text/css':
      return 'css';
    case 'text/javascript':
    case 'application/javascript':
      return 'javascript';
    case 'text/typescript':
      return 'typescript';
    default:
      return 'plaintext';
  }
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

function getSubtaskFromToolPart(part: ToolPart): SubtaskLike | null {
  const toolName = part.tool;
  if (toolName !== 'task') return null;

  const input = part.state.input;
  const subagentType = input['subagent_type'];
  const description = input['description'];

  if (typeof subagentType !== 'string' || typeof description !== 'string') {
    return null;
  }

  const maybeSessionId =
    'metadata' in part.state ? part.state.metadata?.['sessionId'] : undefined;

  return {
    agent: subagentType,
    description,
    childSessionId:
      typeof maybeSessionId === 'string' ? maybeSessionId : undefined,
  };
}

// ---------------------------------------------------------------------------
// Sub-renderers for each Part type
// ---------------------------------------------------------------------------

/** Renders a file part (image thumbnail or file link). */
function FilePartBlock({ part }: { part: SDKFilePart }) {
  const openContent = useViewerStore((s) => s.openContent);
  const isImage = part.mime.startsWith('image/');

  const handleOpen = useCallback(() => {
    if (isImage) {
      openContent({
        type: 'image',
        title: part.filename ?? t('message.image'),
        data: part.url,
      });
    } else {
      const text = decodeDataUriToText(part.url);
      if (text !== null) {
        const languageFromName = part.filename
          ? inferLanguageFromFilename(part.filename)
          : 'plaintext';
        if (part.mime === 'text/markdown') {
          openContent({
            type: 'markdown',
            title: part.filename ?? t('message.file'),
            data: text,
          });
          return;
        }
        openContent({
          type: 'code',
          title: part.filename ?? t('message.file'),
          data: text,
          language:
            languageFromName !== 'plaintext'
              ? languageFromName
              : inferLanguageFromMime(part.mime),
        });
        return;
      }
      openContent({
        type: 'markdown',
        title: part.filename ?? t('message.file'),
        data: `[${part.filename ?? t('message.open_file')}](${part.url})`,
      });
    }
  }, [openContent, part, isImage]);

  if (isImage) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="my-1 block max-w-[200px] cursor-pointer overflow-hidden rounded-md border transition-opacity hover:opacity-80"
      >
        <img
          src={part.url}
          alt={part.filename ?? 'image'}
          className="h-auto w-full"
          loading="lazy"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
    >
      {isImage ? (
        <ImageIcon className="h-3.5 w-3.5" />
      ) : (
        <FileText className="h-3.5 w-3.5" />
      )}
      <span className="truncate font-mono">{part.filename ?? t('message.file')}</span>
    </button>
  );
}

/** Expandable subtask block that shows the subagent's internal workflow. */
function SubtaskBlock({ task }: { task: SubtaskLike }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-primary/10">
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <Brain className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <span className="font-medium truncate">{task.description}</span>
          <span className="ml-2 text-muted-foreground">
            (@{task.agent} subagent)
          </span>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-3 border-l-2 border-primary/20 pl-3 pt-1 pb-1">
          {task.childSessionId ? (
            <SubtaskWorkflow childSessionId={task.childSessionId} />
          ) : (
            <div className="py-1 text-[10px] text-muted-foreground italic">
              {t('message.subtask_unavailable')}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Cost / token summary for a completed step. */
function StepFinishBlock({ part }: { part: StepFinishPart }) {
  const totalTokens =
    part.tokens.input + part.tokens.output + part.tokens.reasoning;
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      <span className="flex items-center gap-0.5">
        <Coins className="h-2.5 w-2.5" />
        {part.cost > 0 ? `$${part.cost.toFixed(4)}` : 'free'}
      </span>
      <span>{totalTokens.toLocaleString()} tokens</span>
      <span className="italic">{part.reason}</span>
    </div>
  );
}

/** Retry notification. */
function RetryBlock({ part }: { part: RetryPart }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-2.5 py-1.5 text-xs text-yellow-500">
      <RefreshCw className="h-3.5 w-3.5" />
      <span>
        {t('message.retry_attempt').replace('{n}', String(part.attempt))}
        {part.error.data.message ? `: ${part.error.data.message}` : ''}
      </span>
    </div>
  );
}

/** Compaction notice. */
function CompactionBlock({ part }: { part: CompactionPart }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <Layers className="h-2.5 w-2.5" />
      <span>{part.auto ? t('message.session_compacted_auto') : t('message.session_compacted')}</span>
    </div>
  );
}

/** Patch part with changed files list. */
function PatchBlock({ part }: { part: PatchPart }) {
  if (part.files.length === 0) return null;
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <GitBranch className="h-2.5 w-2.5" />
      <span>
        {t('message.files_changed').replace('{count}', String(part.files.length))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Part dispatcher
// ---------------------------------------------------------------------------

function PartRenderer({
  part,
  expandOverride,
  activeReasoningPartId,
}: {
  part: Part;
  /** Counter-based override for child expand state (0 = no override). */
  expandOverride?: number;
  /** The currently active (streaming) reasoning part ID, if any. */
  activeReasoningPartId?: string;
}) {
  if (isTextPart(part)) {
    // Skip synthetic / ignored parts
    if (part.synthetic || part.ignored) return null;
    return <MarkdownRenderer content={part.text} />;
  }

  if (isToolPart(part)) {
    const subtaskFromTool = getSubtaskFromToolPart(part);
    if (subtaskFromTool) {
      return <SubtaskBlock task={subtaskFromTool} />;
    }
    return <ToolCallLog part={part} expandOverride={expandOverride} />;
  }

  if (isReasoningPart(part)) {
    return (
      <ReasoningBlock
        part={part}
        expandOverride={expandOverride}
        isActive={part.id === activeReasoningPartId}
      />
    );
  }

  if (isFilePart(part)) {
    return <FilePartBlock part={part} />;
  }

  if (isSubtaskPart(part)) {
    return (
      <SubtaskBlock
        task={{
          agent: part.agent,
          description: part.description,
        }}
      />
    );
  }

  if (isStepStartPart(part)) {
    // Step-start is typically a silent marker; skip rendering
    return null;
  }

  if (isStepFinishPart(part)) {
    return <StepFinishBlock part={part} />;
  }

  if (isRetryPart(part)) {
    return <RetryBlock part={part} />;
  }

  if (isCompactionPart(part)) {
    return <CompactionBlock part={part} />;
  }

  if (isSnapshotPart(part)) {
    // Snapshot parts are internal bookkeeping; hide them
    return null;
  }

  if (isPatchPart(part)) {
    return <PatchBlock part={part} />;
  }

  if (isAgentPart(part)) {
    return (
      <Badge variant="outline" className="text-[10px]">
        Agent: {part.name}
      </Badge>
    );
  }

  return null;
}

function InlinedAttachmentBlock({ part }: { part: InlinedAttachment }) {
  const openContent = useViewerStore((s) => s.openContent);

  const handleOpen = useCallback(() => {
    if (part.mime === 'text/markdown') {
      openContent({
        type: 'markdown',
        title: part.filename,
        data: part.content,
        metadata: { source: 'inlined-attachment', mime: part.mime },
      });
      return;
    }
    openContent({
      type: 'code',
      title: part.filename,
      data: part.content,
      language: inferLanguageFromFilename(part.filename),
      metadata: { source: 'inlined-attachment', mime: part.mime },
    });
  }, [openContent, part]);

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex w-full max-w-[85%] items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50"
      title={t('message.open_attachment_in_viewer')}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-medium">{part.filename}</span>
      <span className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80">
        {part.mime}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Message error display
// ---------------------------------------------------------------------------

function MessageErrorBlock({
  error,
}: {
  error: NonNullable<AssistantMessage['error']>;
}) {
  const normalized = normalizeAssistantError(error);
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="wrap-break-word">{normalized.message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessageItem({
  message,
  isLatest = false,
  onRetry,
  canRetry = false,
  isRetrying = false,
}: {
  message: SessionMessageWithParts;
  isLatest?: boolean;
  onRetry?: (message: SessionMessageWithParts) => void;
  canRetry?: boolean;
  isRetrying?: boolean;
}) {
  // Latest assistant message starts expanded; older ones start collapsed
  const [stepsExpanded, setStepsExpanded] = useState(isLatest);
  const isUser = message.info.role === 'user';

  // Override for expanding/collapsing all individual child steps.
  // Incrementing triggers children to sync; even = collapsed, odd = expanded.
  const [childExpandCounter, setChildExpandCounter] = useState(0);
  const childExpandOpen =
    childExpandCounter > 0 && childExpandCounter % 2 === 1;

  const handleToggleChildSteps = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // If the parent step list is collapsed, open it first so this action
    // has immediate visible feedback.
    setStepsExpanded(true);
    setChildExpandCounter((prev) => prev + 1);
  }, []);

  // Keep latest message expanded as new steps stream in
  useEffect(() => {
    if (isLatest && message.info.role === 'assistant') {
      setStepsExpanded(true);
    }
  }, [isLatest, message.info.role]);
  const assistantError =
    message.info.role === 'assistant' ? message.info.error : undefined;

  // Separate text parts from "step" parts (tools, reasoning, subtask, etc.)
  const textParts = message.parts.filter(isTextPart);
  const stepParts = message.parts.filter((p) => !isTextPart(p));
  const mergedAssistantText = textParts
    .filter((part) => !part.synthetic && !part.ignored)
    .map((part) => part.text)
    .join('\n');

  // Count only parts that will actually render visibly.
  // Excluded: step-start, snapshot (always null), step-finish (cost summary).
  const visibleStepCount = stepParts.filter((p) => {
    if (isStepStartPart(p)) return false;
    if (isSnapshotPart(p)) return false;
    if (isStepFinishPart(p)) return false;
    return true;
  }).length;
  const hasSteps = visibleStepCount > 0;
  const activeReasoningPartId = [...stepParts]
    .reverse()
    .find((p): p is ReasoningPart => isReasoningPart(p) && !p.time.end)?.id;
  const hasActiveStep = stepParts.some((p) => {
    if (isReasoningPart(p)) return p.time.end === undefined;
    if (isToolPart(p)) {
      return p.state.status === 'running' || p.state.status === 'pending';
    }
    return false;
  });
  const renderUserParts = isUser
    ? getNormalizedUserMessageParts(message)
    : message.parts;

  // Keep latest assistant steps expanded while actively streaming,
  // then auto-collapse after completion.
  useEffect(() => {
    if (!isLatest || message.info.role !== 'assistant') return;
    setStepsExpanded(hasActiveStep);
  }, [isLatest, message.info.role, hasActiveStep]);

  return (
    <div className="px-4 py-2">
      <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'flex min-w-0 flex-col gap-1.5',
            isUser ? 'max-w-[78%] items-end' : 'w-full max-w-[780px] items-start',
          )}
        >
          <span className="sr-only">
            {isUser ? 'User message' : 'Assistant message'}
          </span>
        {/* User messages keep the bubble style */}
        {isUser ? (
          <div className="flex flex-col items-end gap-1.5">
            {renderUserParts.map((part) => {
              if (isTextPart(part)) {
                if (part.synthetic || part.ignored) return null;
                const extracted = extractInlinedAttachmentsFromText(part.text);
                if (extracted.attachments.length > 0) {
                  return (
                    <div
                      key={part.id}
                      className="flex w-full flex-col items-end gap-1.5"
                    >
                      {extracted.text.trim().length > 0 && (
                        <div className="rounded-2xl border border-border/60 bg-muted/70 px-3.5 py-2 text-sm text-foreground">
                          <p className="whitespace-pre-wrap wrap-break-word">
                            {extracted.text}
                          </p>
                        </div>
                      )}
                      {extracted.attachments.map((attachment, index) => (
                        <InlinedAttachmentBlock
                          key={`${part.id}-inline-${index}`}
                          part={attachment}
                        />
                      ))}
                    </div>
                  );
                }
                return (
                  <div
                    key={part.id}
                    className="rounded-2xl border border-border/60 bg-muted/70 px-3.5 py-2 text-sm text-foreground"
                  >
                    <p className="whitespace-pre-wrap wrap-break-word">
                      {part.text}
                    </p>
                  </div>
                );
              }

              return (
                <div key={part.id} className="max-w-full">
                  <PartRenderer
                    part={part}
                    activeReasoningPartId={activeReasoningPartId}
                  />
                </div>
              );
            })}
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message)}
                disabled={!canRetry || isRetrying}
                title={
                  !canRetry
                    ? t('message.cannot_retry')
                    : t('message.retry_with_model')
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors',
                  canRetry && !isRetrying
                    ? 'hover:bg-muted/60 hover:text-foreground'
                    : 'cursor-not-allowed opacity-60',
                )}
              >
                {isRetrying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {t('common.retry')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {/* Collapsible steps section */}
            {hasSteps && (
              <Collapsible open={stepsExpanded} onOpenChange={setStepsExpanded}>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CollapsibleTrigger className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-muted/40">
                    {stepsExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span className="font-medium">
                      {visibleStepCount} step{visibleStepCount !== 1 ? 's' : ''}
                    </span>
                  </CollapsibleTrigger>
                  <button
                    type="button"
                    onClick={handleToggleChildSteps}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/40"
                    title={
                      childExpandOpen
                        ? t('message.collapse_child_steps')
                        : t('message.expand_child_steps')
                    }
                  >
                    <ChevronsUpDown className="h-3 w-3" />
                  </button>
                </div>
                <CollapsibleContent>
                  <div className="mt-1.5 flex flex-col gap-1.5 rounded-md border border-border/50 bg-muted/15 p-2">
                    {stepParts.map((part) => (
                      <PartRenderer
                        key={part.id}
                        part={part}
                        expandOverride={childExpandCounter}
                        activeReasoningPartId={activeReasoningPartId}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Text parts merged to preserve markdown fence continuity. */}
            {mergedAssistantText.trim().length > 0 && (
              <MarkdownRenderer content={mergedAssistantText} />
            )}
          </div>
        )}

        {/* Assistant-level error */}
        {assistantError && <MessageErrorBlock error={assistantError} />}
      </div>
    </div>
    </div>
  );
}
