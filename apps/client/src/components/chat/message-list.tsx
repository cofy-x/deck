/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageItem } from './message-item';
import type { SessionMessageWithParts } from './retry-payload';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Distance from the bottom (px) within which auto-scroll stays active. */
const SCROLL_THRESHOLD = 120;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageList({
  messages,
  isLoading,
  onRetryMessage,
  canRetryMessage,
  retryingMessageId,
}: {
  messages: SessionMessageWithParts[];
  isLoading: boolean;
  onRetryMessage?: (message: SessionMessageWithParts) => void;
  canRetryMessage?: (message: SessionMessageWithParts) => boolean;
  retryingMessageId?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Track whether the user is near the bottom of the scroll area
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD);
  }, []);

  // Auto-scroll when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, messages, isAtBottom]);

  // Scroll-to-bottom button handler
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
  }, []);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 text-muted-foreground">
        <MessageSquare className="h-10 w-10" />
        <p className="text-sm">No messages yet. Start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto overscroll-contain py-3"
        onScroll={handleScroll}
      >
        <div className="mx-auto w-full max-w-[920px] px-2 pb-3 sm:px-4">
          {messages.map((msg, idx) => (
            <MessageItem
              key={msg.info.id}
              message={msg}
              isLatest={idx === messages.length - 1}
              onRetry={onRetryMessage}
              canRetry={canRetryMessage ? canRetryMessage(msg) : false}
              isRetrying={retryingMessageId === msg.info.id}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll-to-bottom indicator */}
      {!isAtBottom && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={scrollToBottom}
            className="h-7 rounded-full px-3 shadow-md"
          >
            <ArrowDown className="mr-1 h-3 w-3" />
            New messages
          </Button>
        </div>
      )}
    </div>
  );
}
