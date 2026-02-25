/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useMemo } from 'react';
import { FilePlus, FileMinus, FileEdit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FileDiff } from '@opencode-ai/sdk/v2/client';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DiffViewerProps {
  /** JSON-encoded array of FileDiff objects. */
  data: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: FileDiff['status'] }) {
  switch (status) {
    case 'added':
      return <FilePlus className="h-3.5 w-3.5 text-green-500" />;
    case 'deleted':
      return <FileMinus className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <FileEdit className="h-3.5 w-3.5 text-yellow-500" />;
  }
}

function DiffLine({ line }: { line: string }) {
  const isAdd = line.startsWith('+') && !line.startsWith('+++');
  const isDel = line.startsWith('-') && !line.startsWith('---');
  const isHeader = line.startsWith('@@');

  return (
    <div
      className={cn(
        'px-3 py-0 font-mono text-xs leading-5',
        isAdd && 'bg-green-500/10 text-green-400',
        isDel && 'bg-red-500/10 text-red-400',
        isHeader && 'bg-muted/50 text-blue-400',
        !isAdd && !isDel && !isHeader && 'text-muted-foreground',
      )}
    >
      {line}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single file diff
// ---------------------------------------------------------------------------

function FileDiffBlock({ diff }: { diff: FileDiff }) {
  // Compute a simple unified diff from before/after
  const diffLines = useMemo(() => {
    if (diff.before === '' && diff.after !== '') {
      // New file - show all lines as additions
      return diff.after.split('\n').map((l) => `+${l}`);
    }
    if (diff.after === '' && diff.before !== '') {
      // Deleted file
      return diff.before.split('\n').map((l) => `-${l}`);
    }
    // Modified: show a basic before/after diff
    const beforeLines = diff.before.split('\n');
    const afterLines = diff.after.split('\n');
    const lines: string[] = [];
    lines.push(`@@ -1,${beforeLines.length} +1,${afterLines.length} @@`);
    for (const line of beforeLines) {
      lines.push(`-${line}`);
    }
    for (const line of afterLines) {
      lines.push(`+${line}`);
    }
    return lines;
  }, [diff]);

  return (
    <div className="overflow-hidden rounded-md border">
      {/* File header */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
        <StatusIcon status={diff.status} />
        <span className="flex-1 truncate font-mono text-xs">{diff.file}</span>
        <Badge variant="outline" className="text-[10px] text-green-500">
          +{diff.additions}
        </Badge>
        <Badge variant="outline" className="text-[10px] text-red-500">
          -{diff.deletions}
        </Badge>
      </div>
      {/* Diff lines */}
      <div className="max-h-[400px] overflow-auto bg-[#0d1117]">
        {diffLines.map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiffViewer({ data }: DiffViewerProps) {
  const diffs = useMemo((): FileDiff[] => {
    try {
      return JSON.parse(data) as FileDiff[];
    } catch {
      return [];
    }
  }, [data]);

  if (diffs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No file changes to display.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {diffs.map((diff) => (
          <FileDiffBlock key={diff.file} diff={diff} />
        ))}
      </div>
    </ScrollArea>
  );
}
