/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { Send, Loader2, Paperclip, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import type { FilePartInput } from '@opencode-ai/sdk/v2/client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AgentSelector } from '@/components/config/agent-selector';
import { useChatStore } from '@/stores/chat-store';
import { useImeEnterGuard } from '@/hooks/use-ime-enter-guard';
import {
  MentionPopover,
  useMentionItemCount,
  type MentionItem,
} from './mention-popover';
import {
  CommandPopover,
  useCommandItemCount,
  type CommandItem,
} from './command-popover';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatInputSendPayload {
  text: string;
  agent?: string;
  attachments?: FilePartInput[];
}

/** Identifies which popover is active. */
type PopoverMode = 'none' | 'mention' | 'command';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fileToDataUriWithMime(
  file: File,
  mime: string,
): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = uint8ToBase64(new Uint8Array(buffer));
  return `data:${mime};base64,${base64}`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  jsonl: 'application/x-ndjson',
  yml: 'application/yaml',
  yaml: 'application/yaml',
  xml: 'application/xml',
  csv: 'text/csv',
  ts: 'text/typescript',
  tsx: 'text/tsx',
  js: 'text/javascript',
  jsx: 'text/jsx',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  html: 'text/html',
  css: 'text/css',
  sh: 'application/x-sh',
  py: 'text/x-python',
  go: 'text/x-go',
  rs: 'text/x-rust',
  java: 'text/x-java-source',
  c: 'text/x-c',
  h: 'text/x-c',
  cpp: 'text/x-c++',
  cc: 'text/x-c++',
  hpp: 'text/x-c++',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

function inferMimeFromFilename(name: string): string | null {
  const match = /\.([^.]+)$/.exec(name);
  if (!match) return null;
  const ext = match[1]?.toLowerCase();
  if (!ext) return null;
  return MIME_BY_EXTENSION[ext] ?? null;
}

function resolveAttachmentMime(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  const inferred = inferMimeFromFilename(file.name);
  if (inferred) return inferred;
  // Avoid unsupported octet-stream for common text workflows.
  return 'text/plain';
}

/**
 * Find the @ mention trigger in the input text relative to the cursor.
 * Returns the query text after @ and the start index of @, or null.
 */
function findMentionTrigger(
  text: string,
  cursorPos: number,
): { query: string; start: number } | null {
  const beforeCursor = text.slice(0, cursorPos);
  const atIndex = beforeCursor.lastIndexOf('@');
  if (atIndex < 0) return null;
  // @ must be at start or preceded by whitespace
  if (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1])) return null;
  const query = beforeCursor.slice(atIndex + 1);
  if (query.length > 50) return null;
  return { query, start: atIndex };
}

/**
 * Check if the input text starts with / (command trigger).
 * Returns the command query (text after /) or null.
 */
function findCommandTrigger(text: string): string | null {
  if (!text.startsWith('/')) return null;
  const query = text.slice(1).split(/\s/)[0] ?? '';
  // If there's already a space after the command name, the trigger is done
  if (text.indexOf(' ') > 0) return null;
  return query;
}

// ---------------------------------------------------------------------------
// Attachment chip
// ---------------------------------------------------------------------------

function AttachmentChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
      <Paperclip className="h-3 w-3 shrink-0" />
      <span className="max-w-[120px] truncate">{file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatInput({
  onSend,
  onStop,
  onClientCommand,
  disabled,
  isSending,
  canStop = false,
  isStopping = false,
  directory,
}: {
  onSend: (payload: ChatInputSendPayload) => void;
  onStop?: () => void;
  /** Callback for client-side commands (e.g. /new, /model). */
  onClientCommand?: (commandName: string) => void;
  disabled: boolean;
  isSending: boolean;
  canStop?: boolean;
  isStopping?: boolean;
  /** Current project directory scope for file search. */
  directory?: string | null;
}) {
  const inputText = useChatStore((s) => s.inputText);
  const setInputText = useChatStore((s) => s.setInputText);
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  const focusRequestId = useChatStore((s) => s.focusRequestId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when requestInputFocus() is called (e.g. after dialog closes)
  useEffect(() => {
    if (focusRequestId > 0) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [focusRequestId]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { onCompositionStart, onCompositionEnd, shouldBlockKeyDown } =
    useImeEnterGuard();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Popover state
  const [popoverMode, setPopoverMode] = useState<PopoverMode>('none');
  const [mentionQuery, setMentionQuery] = useState('');
  const [commandQuery, setCommandQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Item counts for keyboard wrapping
  const mentionItemCount = useMentionItemCount(mentionQuery, directory);
  const commandItemCount = useCommandItemCount(commandQuery);

  const currentItemCount = useMemo(() => {
    if (popoverMode === 'mention') return mentionItemCount;
    if (popoverMode === 'command') return commandItemCount;
    return 0;
  }, [popoverMode, mentionItemCount, commandItemCount]);

  // -------------------------------------------------------------------------
  // Mention / command detection on input change
  // -------------------------------------------------------------------------

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setInputText(newText);

      const cursorPos = e.target.selectionStart ?? newText.length;

      // Check for command trigger (/ at start)
      const cmdQuery = findCommandTrigger(newText);
      if (cmdQuery !== null) {
        setPopoverMode('command');
        setCommandQuery(cmdQuery);
        setActiveIndex(0);
        return;
      }

      // Check for mention trigger (@)
      const mention = findMentionTrigger(newText, cursorPos);
      if (mention) {
        setPopoverMode('mention');
        setMentionQuery(mention.query);
        setMentionStart(mention.start);
        setActiveIndex(0);
        return;
      }

      // No trigger found, close popovers
      setPopoverMode('none');
    },
    [setInputText],
  );

  // -------------------------------------------------------------------------
  // Mention selection handler: inserts @agentName or filePath into input
  // -------------------------------------------------------------------------

  const handleMentionSelect = useCallback(
    (item: MentionItem) => {
      const insertText =
        item.type === 'agent' ? `@${item.label} ` : `${item.label} `;
      const before = inputText.slice(0, mentionStart);
      const cursorPos = textareaRef.current?.selectionStart ?? inputText.length;
      const after = inputText.slice(cursorPos);
      const newText = before + insertText + after;
      setInputText(newText);
      setPopoverMode('none');

      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = before.length + insertText.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [inputText, mentionStart, setInputText],
  );

  // -------------------------------------------------------------------------
  // Command selection handler:
  //   - Server commands: insert "/commandName " into input for user to add args
  //   - Client commands: execute immediately via callback
  // -------------------------------------------------------------------------

  const handleCommandSelect = useCallback(
    (item: CommandItem) => {
      setPopoverMode('none');

      if (item.source === 'client') {
        // Client commands execute immediately
        setInputText('');
        if (onClientCommand) {
          onClientCommand(item.name);
        }
      } else {
        // Server commands: insert /commandName into the text box with a space
        const newText = `/${item.name} `;
        setInputText(newText);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(
              newText.length,
              newText.length,
            );
          }
        }, 0);
      }
    },
    [setInputText, onClientCommand],
  );

  // -------------------------------------------------------------------------
  // Send handler
  // -------------------------------------------------------------------------

  const handleSend = useCallback(async () => {
    if (canStop || isSending || isStopping) return;
    const text = inputText.trim();
    if (!text) return;

    const attachments: FilePartInput[] = [];
    for (const file of pendingFiles) {
      const mime = resolveAttachmentMime(file);
      const dataUri = await fileToDataUriWithMime(file, mime);
      console.info('[ChatInput] Attachment MIME resolved', {
        filename: file.name,
        mime,
        dataUriPrefix: dataUri.slice(0, 48),
      });
      attachments.push({
        type: 'file',
        mime,
        filename: file.name,
        url: dataUri,
      });
    }

    onSend({
      text,
      agent: selectedAgent ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setInputText('');
    setPendingFiles([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [
    canStop,
    isSending,
    isStopping,
    inputText,
    pendingFiles,
    selectedAgent,
    onSend,
    setInputText,
  ]);

  // -------------------------------------------------------------------------
  // Popover keyboard selection helper (defined before handleKeyDown)
  // -------------------------------------------------------------------------

  const dispatchPopoverSelect = useCallback(() => {
    if (wrapperRef.current) {
      const selector =
        popoverMode === 'mention'
          ? `[data-mention-index="${activeIndex}"]`
          : `[data-cmd-index="${activeIndex}"]`;
      const el = wrapperRef.current.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
      }
    }
  }, [popoverMode, activeIndex]);

  // -------------------------------------------------------------------------
  // Keyboard handler
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isComposing = shouldBlockKeyDown(e);

      // Handle popover keyboard navigation
      if (popoverMode !== 'none' && currentItemCount > 0) {
        if (isComposing) return;

        switch (e.key) {
          case 'ArrowDown': {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % currentItemCount);
            return;
          }
          case 'ArrowUp': {
            e.preventDefault();
            setActiveIndex((prev) =>
              prev <= 0 ? currentItemCount - 1 : prev - 1,
            );
            return;
          }
          case 'Tab':
          case 'Enter': {
            e.preventDefault();
            dispatchPopoverSelect();
            return;
          }
          case 'Escape': {
            e.preventDefault();
            setPopoverMode('none');
            return;
          }
          default:
            break;
        }
      }

      // Default: Enter sends the message
      if (e.key === 'Enter' && !e.shiftKey) {
        if (isComposing) return;

        if (canStop || isSending || isStopping) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        void handleSend();
      }
    },
    [
      popoverMode,
      currentItemCount,
      canStop,
      isSending,
      isStopping,
      handleSend,
      dispatchPopoverSelect,
      shouldBlockKeyDown,
    ],
  );

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const fileArray = Array.from(files);

      // Validate each file size
      for (const file of fileArray) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(t('chat.file_too_large').replace('{name}', file.name));
          e.target.value = '';
          return;
        }
      }

      // Validate total size
      const totalSize = [...pendingFiles, ...fileArray].reduce(
        (sum, f) => sum + f.size,
        0,
      );

      if (totalSize > MAX_TOTAL_SIZE) {
        toast.error(t('chat.total_size_exceeded'));
        e.target.value = '';
        return;
      }

      setPendingFiles((prev) => [...prev, ...fileArray]);
      e.target.value = '';
    },
    [pendingFiles],
  );

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePopoverClose = useCallback(() => {
    setPopoverMode('none');
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative shrink-0 bg-background px-3 pb-3 pt-2"
    >
      <div className="mx-auto w-full rounded-[22px] border border-border/70 bg-card/95 shadow-sm">
        {/* Attachment preview */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b border-border/60 px-3 py-2">
            {pendingFiles.map((file, i) => (
              <AttachmentChip
                key={`${file.name}-${i}`}
                file={file}
                onRemove={() => handleRemoveFile(i)}
              />
            ))}
          </div>
        )}

        {/* Textarea + popovers container (relative so popovers align with textarea) */}
        <div className="relative px-3 pt-3">
          {/* Mention popover (aligned with textarea width) */}
          <MentionPopover
            open={popoverMode === 'mention'}
            query={mentionQuery}
            activeIndex={activeIndex}
            directory={directory}
            onSelect={handleMentionSelect}
            onClose={handlePopoverClose}
          />

          {/* Command popover (aligned with textarea width) */}
          <CommandPopover
            open={popoverMode === 'command'}
            query={commandQuery}
            activeIndex={activeIndex}
            onSelect={handleCommandSelect}
            onClose={handlePopoverClose}
          />

          <Textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            placeholder={
              disabled
                ? t('chat.placeholder_disabled')
                : t('chat.placeholder_active')
            }
            disabled={disabled || isSending || isStopping || canStop}
            className="h-[44px] min-h-[44px] max-h-[44px] resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 text-sm text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0"
            rows={1}
          />
        </div>
        {/* Toolbar row */}
        <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1.5">
          {/* Left: File attach + Agent selector */}
          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-full p-0"
                    disabled={disabled || isSending || canStop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t('chat.attach_file')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            <AgentSelector className="h-8 rounded-full px-2.5 text-xs" />
          </div>

          {/* Right: Stop / Send */}
          {canStop ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={() => {
                      onStop?.();
                      setInputText('');
                      setPendingFiles([]);
                    }}
                    disabled={disabled || isStopping}
                    size="icon"
                    variant="destructive"
                    className="h-9 w-9 rounded-full"
                  >
                    {isStopping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    <span className="sr-only">{t('common.stop')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t('common.stop')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={disabled || isSending || !inputText.trim()}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="sr-only">{t('common.send')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t('common.send')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}
