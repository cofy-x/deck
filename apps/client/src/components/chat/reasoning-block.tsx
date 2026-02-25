/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ReasoningPart } from '@opencode-ai/sdk/v2/client';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReasoningBlock({
  part,
  expandOverride,
  isActive = false,
}: {
  part: ReasoningPart;
  /** Counter-based override for expand state (0 = no override). */
  expandOverride?: number;
  /** Whether this reasoning block is currently receiving streamed updates. */
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(isActive);

  // State priority:
  // 1) Active reasoning stays open while streaming.
  // 2) Otherwise follow parent expand/collapse override when provided.
  useEffect(() => {
    if (isActive) {
      setOpen(true);
      return;
    }
    if (expandOverride && expandOverride > 0) {
      setOpen(expandOverride % 2 === 1);
    }
  }, [isActive, expandOverride]);
  const isComplete = part.time.end !== undefined;
  const hasContent = !!part.text?.trim();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/50',
          !isComplete && 'animate-pulse border-primary/30',
        )}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <Brain className="h-3.5 w-3.5 shrink-0 text-purple-400" />
        <span className="flex-1 truncate text-left text-muted-foreground">
          {isComplete ? 'Reasoning' : 'Thinking...'}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-md border bg-muted/20 px-3 py-2">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {hasContent
              ? part.text
              : isComplete
                ? 'Reasoning was not exposed by the model.'
                : 'Waiting for reasoning tokens...'}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
