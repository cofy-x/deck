/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Maximize2,
  Pencil,
  FileText,
  BookOpen,
  Search,
  FolderTree,
  List,
  Code2,
  Diff,
  Sparkles,
  ListChecks,
  ClipboardList,
  Globe,
  Compass,
  MessageCircleQuestion,
  Wrench,
} from 'lucide-react';
import type {
  ToolPart,
  ToolState,
  ToolStateCompleted,
  ToolStateError,
  ToolStateRunning,
} from '@opencode-ai/sdk/v2/client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useViewerStore } from '@/stores/viewer-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isCompleted(state: ToolState): state is ToolStateCompleted {
  return state.status === 'completed';
}

function isErrorState(state: ToolState): state is ToolStateError {
  return state.status === 'error';
}

function isRunning(state: ToolState): state is ToolStateRunning {
  return state.status === 'running';
}

// ---------------------------------------------------------------------------
// Tool-specific icon mapping
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate icon component for a built-in tool.
 * Falls back to a generic Wrench icon for unknown / custom tools.
 */
function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase().replace(/^opencode_/, '');

  switch (name) {
    case 'bash':
    case 'shell':
      return Terminal;
    case 'edit':
      return Pencil;
    case 'write':
      return FileText;
    case 'read':
      return BookOpen;
    case 'grep':
    case 'search':
      return Search;
    case 'glob':
      return FolderTree;
    case 'list':
    case 'ls':
      return List;
    case 'lsp':
      return Code2;
    case 'patch':
      return Diff;
    case 'skill':
      return Sparkles;
    case 'todowrite':
      return ListChecks;
    case 'todoread':
      return ClipboardList;
    case 'webfetch':
    case 'fetch':
      return Globe;
    case 'websearch':
      return Compass;
    case 'question':
      return MessageCircleQuestion;
    default:
      return Wrench;
  }
}

/**
 * Returns a human-readable label for the tool category.
 */
function getToolLabel(toolName: string): string {
  const name = toolName.toLowerCase().replace(/^opencode_/, '');

  switch (name) {
    case 'bash':
    case 'shell':
      return 'Shell';
    case 'edit':
      return 'Edit';
    case 'write':
      return 'Write';
    case 'read':
      return 'Read';
    case 'grep':
    case 'search':
      return 'Search';
    case 'glob':
      return 'Glob';
    case 'list':
    case 'ls':
      return 'List';
    case 'lsp':
      return 'LSP';
    case 'patch':
      return 'Patch';
    case 'skill':
      return 'Skill';
    case 'todowrite':
      return 'Todo Write';
    case 'todoread':
      return 'Todo Read';
    case 'webfetch':
    case 'fetch':
      return 'Web Fetch';
    case 'websearch':
      return 'Web Search';
    case 'question':
      return 'Question';
    default:
      return toolName;
  }
}

// ---------------------------------------------------------------------------
// Tool state icon (status indicator)
// ---------------------------------------------------------------------------

function ToolStateIcon({ state }: { state: ToolState }) {
  switch (state.status) {
    case 'running':
    case 'pending':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(startMs: number, endMs: number): string {
  const diff = endMs - startMs;
  if (diff < 1_000) return `${diff}ms`;
  return `${(diff / 1_000).toFixed(1)}s`;
}

function getToolTitle(state: ToolState): string | undefined {
  if (isCompleted(state) || isRunning(state)) {
    return state.title;
  }
  return undefined;
}

function truncateOutput(output: string, maxLength: number = 300): string {
  if (output.length <= maxLength) return output;
  return output.slice(0, maxLength) + '\n... (truncated)';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolCallLog({
  part,
  expandOverride,
}: {
  part: ToolPart;
  /** Counter-based override for expand state (0 = no override). */
  expandOverride?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  // Sync to parent expand/collapse override
  useEffect(() => {
    if (expandOverride && expandOverride > 0) {
      setExpanded(expandOverride % 2 === 1);
    }
  }, [expandOverride]);
  const openContent = useViewerStore((s) => s.openContent);
  const title = getToolTitle(part.state);
  const stateWithTime =
    isCompleted(part.state) || isErrorState(part.state) ? part.state : null;

  const ToolIcon = getToolIcon(part.tool);
  const toolLabel = getToolLabel(part.tool);

  const handleExpandOutput = useCallback(() => {
    if (!isCompleted(part.state)) return;
    openContent({
      type: 'code',
      title: `Output: ${part.tool}`,
      data: part.state.output,
      language: 'plaintext',
    });
  }, [openContent, part]);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          'rounded-md border border-border/60 bg-background/60',
          isErrorState(part.state) &&
            'border-destructive/40 bg-destructive/[0.03]',
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-muted/35">
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <ToolStateIcon state={part.state} />
          <ToolIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-medium">{toolLabel}</span>
          {/* Title / description after the label */}
          {title && (
            <span className="flex-1 truncate text-muted-foreground font-mono">
              {title}
            </span>
          )}
          {!title && (
            <span className="flex-1 truncate text-muted-foreground font-mono">
              {part.tool}
            </span>
          )}
          {/* Duration badge */}
          {stateWithTime && (
            <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {formatDuration(stateWithTime.time.start, stateWithTime.time.end)}
            </span>
          )}
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {part.state.status}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="rounded-b-md border-t border-border/40 bg-muted/15 px-2.5 py-2 text-[11px]">
            {/* Tool name (when title differs) */}
            {title && title !== part.tool && (
              <div className="mb-1 text-muted-foreground">
                <span className="font-semibold">Tool:</span>{' '}
                <span className="font-mono">{part.tool}</span>
              </div>
            )}

            {/* Input */}
            {'input' in part.state &&
              Object.keys(part.state.input).length > 0 && (
                <div className="mb-2">
                  <span className="font-semibold text-muted-foreground">
                    Input:
                  </span>
                  <pre className="mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background/50 p-1.5 font-mono text-muted-foreground">
                    {JSON.stringify(part.state.input, null, 2)}
                  </pre>
                </div>
              )}

            {/* Output (completed) */}
            {isCompleted(part.state) && part.state.output && (
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">
                    Output:
                  </span>
                  {part.state.output.length > 300 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={handleExpandOutput}
                      title="View full output"
                    >
                      <Maximize2 className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
                <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background/50 p-1.5 font-mono text-muted-foreground">
                  {truncateOutput(part.state.output)}
                </pre>
              </div>
            )}

            {/* Error message */}
            {isErrorState(part.state) && (
              <div className="mb-2">
                <span className="font-semibold text-destructive">Error:</span>
                <pre className="mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-destructive/10 p-1.5 font-mono text-destructive">
                  {part.state.error}
                </pre>
              </div>
            )}

            {/* Attachments */}
            {isCompleted(part.state) &&
              part.state.attachments &&
              part.state.attachments.length > 0 && (
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Attachments:
                  </span>
                  <ul className="mt-0.5 space-y-0.5">
                    {part.state.attachments.map((att) => (
                      <li
                        key={att.id}
                        className="truncate font-mono text-muted-foreground"
                      >
                        {att.filename ?? att.url}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Raw metadata fallback */}
            {part.metadata && Object.keys(part.metadata).length > 0 && (
              <div>
                <span className="font-semibold text-muted-foreground">
                  Metadata:
                </span>
                <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-background/50 p-1.5 font-mono text-muted-foreground">
                  {JSON.stringify(part.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
