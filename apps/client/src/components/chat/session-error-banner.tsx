/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SessionError } from '@/stores/chat-store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionErrorBannerProps {
  error: SessionError;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionErrorBanner({
  error,
  onDismiss,
}: SessionErrorBannerProps) {
  return (
    <div className="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <span className="font-semibold">{error.name}: </span>
        <span>{error.message}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 text-destructive hover:text-destructive"
        onClick={onDismiss}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
