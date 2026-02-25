/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useMemo } from 'react';
import { Terminal, Zap } from 'lucide-react';
import { t } from '@/i18n';
import { useServerCommands, getClientCommands } from '@/hooks/use-commands';
import type { Command } from '@opencode-ai/sdk/v2/client';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandItem {
  /** Server or client command. */
  source: 'server' | 'client';
  name: string;
  description?: string;
  shortcut?: string;
}

interface CommandPopoverProps {
  /** Whether the popover is visible. */
  open: boolean;
  /** The search query (text after /). */
  query: string;
  /** The currently highlighted index. */
  activeIndex: number;
  /** Called when the user selects a command. */
  onSelect: (item: CommandItem) => void;
  /** Called when the popover should close. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPopover({
  open,
  query,
  activeIndex,
  onSelect,
  onClose,
}: CommandPopoverProps) {
  const { data: serverCommands } = useServerCommands();
  const listRef = useRef<HTMLDivElement>(null);

  // Build the combined filtered items list
  const items = useMemo(() => {
    const result: CommandItem[] = [];
    const lowerQuery = query.toLowerCase();

    // Server commands first (SDK Command type: description is optional)
    if (serverCommands) {
      for (const cmd of serverCommands as Command[]) {
        if (!lowerQuery || cmd.name.toLowerCase().includes(lowerQuery)) {
          result.push({
            source: 'server',
            name: cmd.name,
            description: cmd.description ?? '',
          });
        }
      }
    }

    // Client commands
    for (const cmd of getClientCommands()) {
      if (!lowerQuery || cmd.name.toLowerCase().includes(lowerQuery)) {
        result.push({
          source: 'client',
          name: cmd.name,
          description: cmd.description,
          shortcut: cmd.shortcut,
        });
      }
    }

    return result;
  }, [serverCommands, query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-cmd-index="${activeIndex}"]`,
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

  const serverItems = items.filter((i) => i.source === 'server');
  const clientItems = items.filter((i) => i.source === 'client');

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 z-50 mb-1 w-full max-w-[680px] rounded-lg border bg-popover shadow-lg"
    >
      <div className="max-h-[220px] overflow-y-auto overscroll-contain p-1">
        {/* Server commands */}
        {serverItems.length > 0 && (
          <div className="px-2 py-0.5 text-[10px] font-medium text-muted-foreground/80 uppercase tracking-wider">
            {t('command.section_header')}
          </div>
        )}
        {serverItems.map((item) => {
          const globalIdx = items.indexOf(item);
          return (
            <CommandItemRow
              key={`server-${item.name}`}
              item={item}
              index={globalIdx}
              isActive={globalIdx === activeIndex}
              onSelect={onSelect}
            />
          );
        })}

        {/* Separator between groups */}
        {serverItems.length > 0 && clientItems.length > 0 && (
          <div className="my-1 border-t" />
        )}

        {/* Client commands */}
        {clientItems.map((item) => {
          const globalIdx = items.indexOf(item);
          return (
            <CommandItemRow
              key={`client-${item.name}`}
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
// Individual command item row
// ---------------------------------------------------------------------------

function CommandItemRow({
  item,
  index,
  isActive,
  onSelect,
}: {
  item: CommandItem;
  index: number;
  isActive: boolean;
  onSelect: (item: CommandItem) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  return (
    <button
      type="button"
      data-cmd-index={index}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors',
        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
      )}
    >
      {item.source === 'server' ? (
        <Terminal className="h-3 w-3 shrink-0 text-primary" />
      ) : (
        <Zap className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium leading-5">/{item.name}</span>
          {item.description && (
            <span
              title={item.description}
              className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted-foreground"
            >
              {item.description}
            </span>
          )}
        </div>
        {item.shortcut && (
          <kbd className="shrink-0 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
            {item.shortcut}
          </kbd>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Hook: compute visible item count (for parent keyboard navigation)
// ---------------------------------------------------------------------------

export function useCommandItemCount(query: string): number {
  const { data: serverCommands } = useServerCommands();
  const lowerQuery = query.toLowerCase();

  let count = 0;
  if (serverCommands) {
    count += (serverCommands as Command[]).filter(
      (cmd) => !lowerQuery || cmd.name.toLowerCase().includes(lowerQuery),
    ).length;
  }
  count += getClientCommands().filter(
    (cmd) => !lowerQuery || cmd.name.toLowerCase().includes(lowerQuery),
  ).length;
  return count;
}
