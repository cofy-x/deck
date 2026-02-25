/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from '@/components/chat/markdown-renderer';
import { DiffViewer } from './diff-viewer';
import { ViewerToolbar } from './viewer-toolbar';
import { highlightCode } from '@/lib/shiki';
import { useViewerStore } from '@/stores/viewer-store';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Sub-viewers
// ---------------------------------------------------------------------------

/** Full-width markdown viewer. */
function MarkdownViewer({ data }: { data: string }) {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl overflow-hidden p-6">
        <MarkdownRenderer content={data} />
      </div>
    </ScrollArea>
  );
}

/** Syntax-highlighted code viewer — fills the entire viewer area. */
function CodeViewer({ data, language }: { data: string; language: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void highlightCode(data, language).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [data, language]);

  // Use native overflow scroll instead of ScrollArea for full dual-axis support
  return (
    <div className="h-full overflow-auto bg-[#0d1117] p-4 text-sm leading-relaxed">
      {html ? (
        <div
          className="[&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0!"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="m-0 bg-transparent p-0">
          <code>{data}</code>
        </pre>
      )}
    </div>
  );
}

/** Zoomable image viewer. */
function ImageViewer({ data, title }: { data: string; title: string }) {
  return (
    <ScrollArea className="h-full">
      <div className="flex items-center justify-center p-6">
        <img
          src={data}
          alt={title}
          className="max-h-full max-w-full rounded-md border object-contain"
        />
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyViewer() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <FileQuestion className="h-10 w-10" />
      <p className="text-sm">{t('viewer.idle_hint')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContentViewer() {
  const content = useViewerStore((s) => s.content);

  // Plaintext "code" content is better rendered as markdown for wrapping
  const isPlaintextCode =
    content?.type === 'code' &&
    (!content.language ||
      content.language === 'plaintext' ||
      content.language === 'text');

  return (
    <div className="flex h-full flex-col">
      <ViewerToolbar />
      <div className="min-h-0 flex-1 overflow-hidden">
        {!content && <EmptyViewer />}
        {content?.type === 'markdown' && <MarkdownViewer data={content.data} />}
        {content?.type === 'code' && isPlaintextCode && (
          <MarkdownViewer data={content.data} />
        )}
        {content?.type === 'code' && !isPlaintextCode && (
          <CodeViewer
            data={content.data}
            language={content.language ?? 'plaintext'}
          />
        )}
        {content?.type === 'diff' && <DiffViewer data={content.data} />}
        {content?.type === 'image' && (
          <ImageViewer data={content.data} title={content.title} />
        )}
      </div>
    </div>
  );
}
