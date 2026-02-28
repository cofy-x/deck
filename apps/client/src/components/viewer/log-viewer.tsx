/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Trash2,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Copy,
  Pause,
  Play,
  Pin,
  PinOff,
} from 'lucide-react';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useDebugStore, ALL_LOG_CATEGORIES } from '@/stores/debug-store';
import { useViewerStore } from '@/stores/viewer-store';
import type { DebugLogEntry, LogCategory } from '@/stores/debug-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hms = d.toLocaleTimeString('en-US', { hour12: false });
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hms}.${ms}`;
}

function statusColor(status?: number): string {
  if (!status) return 'text-muted-foreground';
  if (status >= 200 && status < 300) return 'text-green-500';
  if (status >= 400 && status < 500) return 'text-yellow-500';
  return 'text-red-500';
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-blue-500/15 text-blue-500';
    case 'POST':
      return 'bg-green-500/15 text-green-500';
    case 'PUT':
    case 'PATCH':
      return 'bg-yellow-500/15 text-yellow-500';
    case 'DELETE':
      return 'bg-red-500/15 text-red-500';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function tryFormatJson(raw?: string): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Strip the base URL prefix to show only the path portion. */
function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

const CATEGORY_I18N: Record<LogCategory, string> = {
  api: 'log.filter.api',
  sse: 'log.filter.sse',
  error: 'log.filter.error',
  system: 'log.filter.system',
};

// ---------------------------------------------------------------------------
// Inline copy button
// ---------------------------------------------------------------------------

function CopyButton({
  text,
  title,
  className,
}: {
  text: string;
  title: string;
  className?: string;
}) {
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      copyToClipboard(text);
    },
    [text],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
      title={title}
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Single log entry
// ---------------------------------------------------------------------------

function LogEntryItem({
  entry,
  isPinned,
  onTogglePin,
  onOpenResponseInViewer,
}: {
  entry: DebugLogEntry;
  isPinned: boolean;
  onTogglePin: () => void;
  onOpenResponseInViewer: (entry: DebugLogEntry) => void;
}) {
  const [open, setOpen] = useState(false);

  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTogglePin();
    },
    [onTogglePin],
  );

  const handleOpenResponseInViewer = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenResponseInViewer(entry);
    },
    [entry, onOpenResponseInViewer],
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center gap-2 border-b px-3 py-1.5 text-[11px] transition-colors hover:bg-muted/50',
          isPinned && 'bg-primary/5',
        )}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="shrink-0 font-mono text-muted-foreground">
          {formatTime(entry.timestamp)}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 px-1.5 py-0 text-[10px] font-mono',
            methodColor(entry.method),
          )}
        >
          {entry.method}
        </Badge>
        <span className={cn('shrink-0 font-mono', statusColor(entry.status))}>
          {entry.status ?? '---'}
        </span>
        {entry.durationMs !== undefined && (
          <span className="shrink-0 text-muted-foreground">
            {entry.durationMs}ms
          </span>
        )}
        <span className="flex-1 truncate text-left font-mono text-muted-foreground">
          {entry.summary ?? shortenUrl(entry.url)}
        </span>
        {entry.error && (
          <Badge variant="destructive" className="shrink-0 text-[10px]">
            Error
          </Badge>
        )}
        {/* Pin toggle */}
        <button
          type="button"
          onClick={handlePin}
          className={cn(
            'shrink-0 rounded p-0.5 transition-colors hover:bg-muted',
            isPinned
              ? 'text-primary'
              : 'text-muted-foreground/60 opacity-40 group-hover:opacity-100',
          )}
          title={isPinned ? t('log.unpin') : t('log.pin_to_top')}
        >
          {isPinned ? (
            <PinOff className="h-3 w-3" />
          ) : (
            <Pin className="h-3 w-3" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-b bg-muted/20 px-3 py-2 text-[11px]">
          {/* Full URL */}
          <div className="mb-2 flex items-start gap-1">
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-muted-foreground">
                {t('log.url_label')}{' '}
              </span>
              <span className="font-mono wrap-break-word">{entry.url}</span>
            </div>
            <CopyButton text={entry.url} title={t('log.copy_url')} />
          </div>

          {/* Request body */}
          {entry.requestBody && (
            <div className="mb-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">
                  {t('log.request_body')}
                </span>
                <CopyButton
                  text={entry.requestBody}
                  title={t('log.copy_request')}
                />
              </div>
              <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background/50 p-1.5 font-mono text-muted-foreground wrap-break-word">
                {tryFormatJson(entry.requestBody)}
              </pre>
            </div>
          )}

          {/* Response body */}
          {entry.responseBody && (
            <div className="mb-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">
                  {t('log.response_body')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleOpenResponseInViewer}
                    className="rounded px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t('log.open_in_viewer')}
                  >
                    {t('log.open_in_viewer')}
                  </button>
                  <CopyButton
                    text={entry.responseBody}
                    title={t('log.copy_response')}
                  />
                </div>
              </div>
              <pre className="mt-0.5 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-background/50 p-1.5 font-mono text-muted-foreground wrap-break-word">
                {tryFormatJson(entry.responseBody)}
              </pre>
            </div>
          )}

          {/* Error */}
          {entry.error && (
            <div className="flex items-start gap-1">
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-destructive">
                  {t('log.error_label')}
                </span>
                <span className="text-destructive">{entry.error}</span>
              </div>
              <CopyButton text={entry.error} title={t('log.copy_error')} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LogViewer() {
  const entries = useDebugStore((s) => s.entries);
  const pinnedIds = useDebugStore((s) => s.pinnedIds);
  const activeFilters = useDebugStore((s) => s.activeFilters);
  const paused = useDebugStore((s) => s.paused);
  const setPaused = useDebugStore((s) => s.setPaused);
  const togglePin = useDebugStore((s) => s.togglePin);
  const toggleFilter = useDebugStore((s) => s.toggleFilter);
  const clearEntries = useDebugStore((s) => s.clearEntries);
  const openContent = useViewerStore((s) => s.openContent);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { pinnedEntries, liveEntries } = useMemo(() => {
    const pinned: DebugLogEntry[] = [];
    const unpinned: DebugLogEntry[] = [];
    for (const entry of entries) {
      const visible = activeFilters.has(entry.category);
      if (pinnedIds.has(entry.id)) {
        pinned.push(entry);
      } else if (visible) {
        unpinned.push(entry);
      }
    }
    return { pinnedEntries: pinned, liveEntries: unpinned };
  }, [entries, pinnedIds, activeFilters]);

  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveEntries.length, autoScroll, paused]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  const handleOpenResponseInViewer = useCallback(
    (entry: DebugLogEntry) => {
      if (!entry.responseBody) return;
      const titleTarget = entry.summary ?? shortenUrl(entry.url);
      openContent({
        type: 'code',
        title: `Response: ${titleTarget}`,
        data: tryFormatJson(entry.responseBody),
        language: 'json',
        metadata: {
          source: 'log-viewer',
          logEntryId: entry.id,
          timestamp: entry.timestamp,
        },
      });
    },
    [openContent],
  );

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-col border-b">
        <div className="flex h-10 items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('log.title')}</span>
            <Badge variant="secondary" className="text-[10px]">
              {entries.length}
            </Badge>
            {paused && (
              <Badge variant="outline" className="text-[10px] text-yellow-500">
                {t('common.paused')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaused(!paused)}
              className="h-7 gap-1 px-2 text-xs"
              title={paused ? t('log.resume_logging') : t('log.pause_logging')}
            >
              {paused ? (
                <Play className="h-3 w-3" />
              ) : (
                <Pause className="h-3 w-3" />
              )}
              {paused ? t('log.resume') : t('log.pause')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearEntries}
              className="h-7 gap-1 px-2 text-xs"
              title={t('log.clear_log')}
            >
              <Trash2 className="h-3 w-3" />
              {t('log.clear')}
            </Button>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1 px-3 pb-1.5">
          {ALL_LOG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleFilter(cat)}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                activeFilters.has(cat)
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/50 text-muted-foreground/60',
              )}
            >
              {t(CATEGORY_I18N[cat])}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('log.no_entries')}
          </div>
        ) : (
          <>
            {pinnedEntries.length > 0 && (
              <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/75">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('log.pinned')} ({pinnedEntries.length})
                </div>
                {pinnedEntries.map((entry) => (
                  <LogEntryItem
                    key={entry.id}
                    entry={entry}
                    isPinned
                    onTogglePin={() => togglePin(entry.id)}
                    onOpenResponseInViewer={handleOpenResponseInViewer}
                  />
                ))}
              </div>
            )}
            {liveEntries.length > 0 && (
              <>
                {pinnedEntries.length > 0 && (
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('log.live')}
                  </div>
                )}
                {liveEntries.map((entry) => (
                  <LogEntryItem
                    key={entry.id}
                    entry={entry}
                    isPinned={false}
                    onTogglePin={() => togglePin(entry.id)}
                    onOpenResponseInViewer={handleOpenResponseInViewer}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Scroll-to-bottom */}
      {!autoScroll && (
        <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            onClick={scrollToBottom}
            className="h-6 rounded-full px-3 text-xs shadow-md"
          >
            <ArrowDown className="mr-1 h-3 w-3" />
            {t('log.latest')}
          </Button>
        </div>
      )}
    </div>
  );
}
