/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useMemo } from 'react';
import { Brain, FileText, FolderOpen } from 'lucide-react';
import { useSubagents, useFindFiles } from '@/hooks/use-mention';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MentionItem {
  type: 'agent' | 'file';
  /** Display label (agent name or file path). */
  label: string;
  /** Optional description (agent description). */
  description?: string;
  /** Optional color (agent color). */
  color?: string;
}

interface MentionPopoverProps {
  /** Whether the popover is visible. */
  open: boolean;
  /** The search query (text after @). */
  query: string;
  /** The currently highlighted index. */
  activeIndex: number;
  /** Project directory scope for file search. */
  directory?: string | null;
  /** Called when the user selects an item. */
  onSelect: (item: MentionItem) => void;
  /** Called when the popover should close. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MentionPopover({
  open,
  query,
  activeIndex,
  directory,
  onSelect,
  onClose,
}: MentionPopoverProps) {
  const { data: subagents } = useSubagents();
  const { data: files } = useFindFiles(query, directory);
  const listRef = useRef<HTMLDivElement>(null);

  // Build the combined items list
  const items = useMemo(() => {
    const result: MentionItem[] = [];

    if (subagents) {
      const filtered = query
        ? subagents.filter((a) =>
            a.name.toLowerCase().includes(query.toLowerCase()),
          )
        : subagents;
      for (const agent of filtered) {
        result.push({
          type: 'agent',
          label: agent.name,
          description: agent.description,
          color: agent.color,
        });
      }
    }

    if (files) {
      for (const filePath of files) {
        result.push({ type: 'file', label: filePath });
      }
    }

    return result;
  }, [subagents, files, query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-mention-index="${activeIndex}"]`,
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open || items.length === 0) return null;

  const agentItems = items.filter((i) => i.type === 'agent');
  const fileItems = items.filter((i) => i.type === 'file');

  return (
    <div
      ref={listRef}
      className="absolute inset-x-0 bottom-full z-50 mb-1 rounded-lg border bg-popover shadow-lg"
    >
      <div className="max-h-[240px] overflow-y-auto overscroll-contain p-1">
        {/* Agent items */}
        {agentItems.length > 0 && (
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Agents
          </div>
        )}
        {agentItems.map((item) => {
          const globalIdx = items.indexOf(item);
          return (
            <MentionItemRow
              key={`agent-${item.label}`}
              item={item}
              index={globalIdx}
              isActive={globalIdx === activeIndex}
              onSelect={onSelect}
            />
          );
        })}

        {/* File items */}
        {fileItems.length > 0 && (
          <div className="mt-1 px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Files
          </div>
        )}
        {fileItems.map((item) => {
          const globalIdx = items.indexOf(item);
          return (
            <MentionItemRow
              key={`file-${item.label}`}
              item={item}
              index={globalIdx}
              isActive={globalIdx === activeIndex}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual mention item row
// ---------------------------------------------------------------------------

function MentionItemRow({
  item,
  index,
  isActive,
  onSelect,
}: {
  item: MentionItem;
  index: number;
  isActive: boolean;
  onSelect: (item: MentionItem) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  const isFile = item.type === 'file';
  const isDirectory = isFile && !item.label.includes('.');

  return (
    <button
      type="button"
      data-mention-index={index}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
      )}
    >
      {item.type === 'agent' ? (
        <Brain className="h-3.5 w-3.5 shrink-0 text-primary" />
      ) : isDirectory ? (
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate font-medium',
            item.type === 'file' && 'font-mono',
          )}
          style={item.color ? { color: item.color } : undefined}
        >
          {item.type === 'agent' ? `@${item.label}` : item.label}
        </span>
        {item.description && (
          <span className="truncate text-[10px] text-muted-foreground">
            {item.description}
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Hook: compute the number of visible items (used by parent for key nav)
// ---------------------------------------------------------------------------

export function useMentionItemCount(
  query: string,
  directory?: string | null,
): number {
  const { data: subagents } = useSubagents();
  const { data: files } = useFindFiles(query, directory);

  let count = 0;
  if (subagents) {
    const filtered = query
      ? subagents.filter((a) =>
          a.name.toLowerCase().includes(query.toLowerCase()),
        )
      : subagents;
    count += filtered.length;
  }
  if (files) {
    count += files.length;
  }
  return count;
}
