/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import { t } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReplyPermission } from '@/hooks/use-session';
import type { PermissionRequest } from '@opencode-ai/sdk/v2/client';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionDialogProps {
  /** The list of pending permission requests. Only the first is shown. */
  permissions: PermissionRequest[];
  /** Callback to remove a permission from the pending list after reply. */
  onDismiss: (permissionId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionDialog({
  permissions,
  onDismiss,
}: PermissionDialogProps) {
  const replyPermission = useReplyPermission();
  const current = permissions[0] as PermissionRequest | undefined;

  const handleReply = useCallback(
    (reply: 'once' | 'always' | 'reject') => {
      if (!current) return;
      replyPermission.mutate(
        { requestID: current.id, reply },
        { onSettled: () => onDismiss(current.id) },
      );
    },
    [current, replyPermission, onDismiss],
  );

  return (
    <Dialog
      open={!!current}
      onOpenChange={() => current && onDismiss(current.id)}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-yellow-500" />
            {t('permission.title')}
          </DialogTitle>
          <DialogDescription>
            {t('permission.description')}
          </DialogDescription>
        </DialogHeader>

        {current && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t('permission.label')}</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {current.permission}
              </Badge>
            </div>

            {current.patterns.length > 0 && (
              <div>
                <span className="text-sm font-medium">{t('permission.patterns')}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {current.patterns.map((pattern) => (
                    <Badge
                      key={pattern}
                      variant="outline"
                      className="font-mono text-xs"
                    >
                      {pattern}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(current.metadata).length > 0 && (
              <div>
                <span className="text-sm font-medium">{t('permission.details')}</span>
                <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(current.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleReply('reject')}
            disabled={replyPermission.isPending}
          >
            {t('permission.reject')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleReply('once')}
            disabled={replyPermission.isPending}
          >
            {t('permission.allow_once')}
          </Button>
          <Button
            size="sm"
            onClick={() => handleReply('always')}
            disabled={replyPermission.isPending}
          >
            {t('permission.always_allow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
