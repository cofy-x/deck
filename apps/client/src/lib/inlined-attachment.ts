/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InlinedAttachment {
  filename: string;
  mime: string;
  content: string;
}

export interface InlinedAttachmentExtraction {
  text: string;
  attachments: InlinedAttachment[];
}

function parseAttachmentHeader(
  lines: string[],
  index: number,
): { filename: string; mime: string } | null {
  if (index + 1 >= lines.length) return null;
  const fileMatch = /^Attached file:\s*(.+)$/i.exec(
    (lines[index] ?? '').trim(),
  );
  const mimeMatch = /^MIME:\s*(.+)$/i.exec((lines[index + 1] ?? '').trim());
  if (!fileMatch?.[1] || !mimeMatch?.[1]) return null;
  return {
    filename: fileMatch[1].trim(),
    mime: mimeMatch[1].trim(),
  };
}

export function buildInlinedAttachmentText(params: {
  filename?: string;
  mime: string;
  content: string;
}): string {
  const { filename, mime, content } = params;
  return [
    `Attached file: ${filename ?? 'unnamed'}`,
    `MIME: ${mime}`,
    content,
  ].join('\n');
}

export function parseInlinedAttachmentText(
  text: string,
): InlinedAttachment | null {
  const extracted = extractInlinedAttachmentsFromText(text);
  if (extracted.text.trim().length > 0 || extracted.attachments.length !== 1) {
    return null;
  }
  return extracted.attachments[0] ?? null;
}

export function extractInlinedAttachmentsFromText(
  text: string,
): InlinedAttachmentExtraction {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.includes('Attached file:')) {
    return { text: text.trim(), attachments: [] };
  }

  const lines = normalized.split('\n');
  const attachments: InlinedAttachment[] = [];
  const plainLines: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const header = parseAttachmentHeader(lines, index);
    if (!header) {
      plainLines.push(lines[index] ?? '');
      index += 1;
      continue;
    }

    let nextHeaderIndex = index + 2;
    while (
      nextHeaderIndex < lines.length &&
      !parseAttachmentHeader(lines, nextHeaderIndex)
    ) {
      nextHeaderIndex += 1;
    }

    const contentLines = lines.slice(index + 2, nextHeaderIndex);
    const normalizedContent =
      contentLines[0] === '' ? contentLines.slice(1) : contentLines;
    attachments.push({
      filename: header.filename,
      mime: header.mime,
      content: normalizedContent.join('\n'),
    });

    index = nextHeaderIndex;
  }

  return {
    text: plainLines.join('\n').trim(),
    attachments,
  };
}

export function encodeTextDataUri(content: string, mime: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
