/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import type {
  FilePart,
  FilePartInput,
  Part,
  SessionMessagesResponse,
  TextPart,
} from '@opencode-ai/sdk/v2/client';
import {
  encodeTextDataUri,
  extractInlinedAttachmentsFromText,
} from '@/lib/inlined-attachment';

export type SessionMessageWithParts = SessionMessagesResponse[number];

export interface UserMessageRetryPayload {
  prompt: string;
  agent?: string;
  attachments?: FilePartInput[];
}

function getUserPartDedupKey(part: Part): string | null {
  if (part.type === 'text') {
    if (part.synthetic || part.ignored) return null;
    const normalizedText = part.text.trim();
    if (!normalizedText) return null;
    return `text:${normalizedText}`;
  }
  if (part.type === 'file') {
    return `file:${part.filename ?? ''}|${part.mime}|${part.url}`;
  }
  return null;
}

export function getNormalizedUserMessageParts(
  message: SessionMessageWithParts,
): Part[] {
  if (message.info.role !== 'user') return message.parts;

  const seen = new Set<string>();
  const normalized: Part[] = [];
  for (const part of message.parts) {
    const key = getUserPartDedupKey(part);
    if (!key) {
      normalized.push(part);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(part);
  }
  return normalized;
}

function isVisibleTextPart(part: Part): part is TextPart {
  return part.type === 'text' && !part.synthetic && !part.ignored;
}

function isFilePart(part: Part): part is FilePart {
  return part.type === 'file';
}

function mapFilePartToInput(part: FilePart): FilePartInput {
  return {
    type: 'file',
    mime: part.mime,
    filename: part.filename,
    url: part.url,
    ...(part.source ? { source: part.source } : {}),
  };
}

export function buildRetryPayloadFromUserMessage(
  message: SessionMessageWithParts,
): UserMessageRetryPayload | null {
  if (message.info.role !== 'user') return null;
  const normalizedParts = getNormalizedUserMessageParts(message);

  const textParts: string[] = [];
  const attachments: FilePartInput[] = [];

  for (const part of normalizedParts) {
    if (isFilePart(part)) {
      attachments.push(mapFilePartToInput(part));
      continue;
    }
    if (!isVisibleTextPart(part)) continue;

    const extracted = extractInlinedAttachmentsFromText(part.text);
    if (extracted.attachments.length > 0) {
      if (extracted.text.trim().length > 0) {
        textParts.push(extracted.text);
      }

      for (const inlinedAttachment of extracted.attachments) {
        attachments.push({
          type: 'file',
          mime: inlinedAttachment.mime,
          filename: inlinedAttachment.filename,
          url: encodeTextDataUri(
            inlinedAttachment.content,
            inlinedAttachment.mime,
          ),
        });
      }
      continue;
    }

    textParts.push(part.text);
  }

  const prompt = textParts.join('\n').trim();
  if (!prompt) return null;

  return {
    prompt,
    agent: message.info.agent || undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

export function isRetryableUserMessage(
  message: SessionMessageWithParts,
): boolean {
  return buildRetryPayloadFromUserMessage(message) !== null;
}
