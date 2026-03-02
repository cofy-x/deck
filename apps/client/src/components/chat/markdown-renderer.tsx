/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { highlightCode } from '@/lib/shiki';
import { normalizeMarkdown } from '@/lib/markdown-normalize';
import { useViewerStore } from '@/stores/viewer-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Highlighted code block (async shiki integration)
// ---------------------------------------------------------------------------

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const openContent = useViewerStore((s) => s.openContent);

  useEffect(() => {
    let cancelled = false;
    void highlightCode(code, language).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code);
  }, [code]);

  const handleExpand = useCallback(() => {
    openContent({
      type: 'code',
      title: language ? `Code (${language})` : 'Code',
      data: code,
      language,
    });
  }, [openContent, code, language]);

  return (
    <div className="group relative my-2 overflow-hidden rounded-md border bg-[#0d1117]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
        <span className="font-mono">{language || 'plaintext'}</span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleCopy}
            title="Copy code"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleExpand}
            title="Open in viewer"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {/* Code content — capped height so long blocks don't fill the viewport */}
      {html ? (
        <div
          className="max-h-[400px] overflow-auto p-3 text-xs leading-relaxed [&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0!"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="max-h-[400px] overflow-auto p-3 text-xs leading-relaxed">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom react-markdown component overrides
// ---------------------------------------------------------------------------

export type MarkdownTone = 'default' | 'high-contrast';

function buildMarkdownComponents(tone: MarkdownTone): Components {
  const contentTextClass =
    tone === 'high-contrast' ? 'text-foreground' : 'text-foreground/90';

  return {
    // Fenced code blocks
    code({ className, children, ...rest }) {
      const match = /language-(\w+)/.exec(className ?? '');
      const codeString = String(children).replace(/\n$/, '');
      const isBlockCode = Boolean(match) || codeString.includes('\n');

      // Block code (fenced or multiline fallback)
      if (isBlockCode) {
        return (
          <CodeBlock language={match?.[1] ?? 'plaintext'} code={codeString} />
        );
      }

      // Inline code
      return (
        <code
          className={cn(
            'rounded-md border border-border/60 bg-muted/55 px-1.5 py-0.5 font-mono text-[0.85em]',
            contentTextClass,
            className,
          )}
          {...rest}
        >
          {children}
        </code>
      );
    },

    // Override <pre> to avoid double-wrapping with CodeBlock
    pre({ children }) {
      return <>{children}</>;
    },

    // Tables
    table({ children }) {
      return (
        <div className="my-2 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">{children}</table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-muted/50">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="border-b px-3 py-1.5 text-left text-xs font-semibold">
          {children}
        </th>
      );
    },
    td({ children }) {
      return <td className="border-b px-3 py-1.5 text-xs">{children}</td>;
    },

    // Links
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {children}
        </a>
      );
    },

    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="my-2 border-l-2 border-primary/50 pl-3 text-muted-foreground italic">
          {children}
        </blockquote>
      );
    },

    // Lists
    ul({ children }) {
      return <ul className="my-1.5 list-inside list-disc pl-2">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="my-1.5 list-inside list-decimal pl-2">{children}</ol>;
    },
    li({ children }) {
      return (
        <li className={cn('my-0.5 text-[15px] leading-7', contentTextClass)}>
          {children}
        </li>
      );
    },

    // Paragraphs
    p({ children }) {
      return (
        <p className={cn('my-1.5 wrap-break-word text-[15px] leading-7', contentTextClass)}>
          {children}
        </p>
      );
    },

    // Headings
    h1({ children }) {
      return <h1 className="my-2 text-lg font-semibold tracking-tight text-foreground">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="my-2 text-base font-semibold tracking-tight text-foreground">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="my-1.5 text-sm font-semibold text-foreground">{children}</h3>;
    },

    // Horizontal rule
    hr() {
      return <hr className="my-3 border-border" />;
    },

    // Images
    img({ src, alt }) {
      return (
        <img
          src={src}
          alt={alt ?? ''}
          className="my-2 max-w-full rounded-md border"
          loading="lazy"
        />
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export interface MarkdownRendererProps {
  /** The raw markdown string to render. */
  content: string;
  /** Additional CSS classes on the wrapper. */
  className?: string;
  /** Text contrast profile for markdown content. */
  tone?: MarkdownTone;
}

/**
 * Renders a markdown string with GFM support and Shiki-powered
 * syntax highlighting. Code blocks include copy and expand-to-viewer
 * actions.
 */
export const MarkdownRenderer = memo(
  ({ content, className, tone = 'default' }: MarkdownRendererProps) => {
    const normalized = useMemo(() => normalizeMarkdown(content), [content]);
    const components = useMemo(() => buildMarkdownComponents(tone), [tone]);
    return (
      <div
        className={cn(
          'prose-sm max-w-full overflow-hidden wrap-break-word',
          tone === 'high-contrast' ? 'text-foreground' : 'text-foreground/90',
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={components}
        >
          {normalized}
        </ReactMarkdown>
      </div>
    );
  },
);

MarkdownRenderer.displayName = 'MarkdownRenderer';
