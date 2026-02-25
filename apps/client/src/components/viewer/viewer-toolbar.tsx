/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback } from 'react';
import { Copy, X, Check } from 'lucide-react';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useViewerStore } from '@/stores/viewer-store';
import type { ViewerContentType } from '@/stores/viewer-store';
import { useTransientFlag } from '@/hooks/use-transient-flag';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeLabel(type: ViewerContentType): string {
  switch (type) {
    case 'markdown':
      return t('viewer.type_markdown');
    case 'code':
      return t('viewer.type_code');
    case 'diff':
      return t('viewer.type_diff');
    case 'image':
      return t('viewer.type_image');
    default:
      return String(type).toUpperCase();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerToolbar() {
  const content = useViewerStore((s) => s.content);
  const clearContent = useViewerStore((s) => s.clearContent);
  const { active: copied, trigger: triggerCopied } = useTransientFlag(1200);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content.data);
      triggerCopied();
    } catch {
      toast.error(t('viewer.copy_failed'));
    }
  }, [content, triggerCopied]);

  if (!content) return null;

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2 overflow-hidden">
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {getTypeLabel(content.type)}
        </Badge>
        <span className="truncate text-sm font-medium">{content.title}</span>
      </div>
      <div className="flex items-center gap-1">
        {content.type !== 'image' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            title={copied ? t('common.copied') : t('viewer.copy_content')}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={clearContent}
          title={t('viewer.close_viewer')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
