/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import type {
  Part,
  TextPart,
  ToolPart,
  ReasoningPart,
} from '@opencode-ai/sdk/v2/client';
import { useSessionMessages } from '@/hooks/use-session';
import { ToolCallLog } from './tool-call-log';
import { ReasoningBlock } from './reasoning-block';
import { MarkdownRenderer } from './markdown-renderer';
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the internal workflow of a child (subagent) session.
 * Fetches the child session's messages and displays tool calls, reasoning,
 * and text parts in a compact format.
 */
export function SubtaskWorkflow({
  childSessionId,
}: {
  childSessionId: string;
}) {
  const { data: messages, isLoading } = useSessionMessages(childSessionId);
  if (isLoading) {
    return (
      <div className="py-1 text-[10px] text-muted-foreground">
        {t('subtask.loading')}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="py-1 text-[10px] text-muted-foreground italic">
        {t('subtask.no_steps')}
      </div>
    );
  }

  // Collect only interesting parts from assistant messages
  const parts: Part[] = [];
  for (const msg of messages) {
    if (msg.info.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (isToolPart(part) || isReasoningPart(part) || isTextPart(part)) {
        // Skip synthetic / ignored text parts
        if (isTextPart(part) && (part.synthetic || part.ignored)) continue;
        parts.push(part);
      }
    }
  }

  if (parts.length === 0) {
    return (
      <div className="py-1 text-[10px] text-muted-foreground italic">
        {t('subtask.no_visible_steps')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {parts.map((part) => {
        if (isToolPart(part)) {
          return <ToolCallLog key={part.id} part={part} />;
        }
        if (isReasoningPart(part)) {
          return <ReasoningBlock key={part.id} part={part} />;
        }
        if (isTextPart(part)) {
          return (
            <div key={part.id} className="text-xs">
              <MarkdownRenderer content={part.text} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
