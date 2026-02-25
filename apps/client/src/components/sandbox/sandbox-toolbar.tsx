/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { RefreshCw, Square } from 'lucide-react';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { SandboxStatusBadge } from './status-badge';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useSandboxState, useStopSandbox } from '@/hooks/use-sandbox';
import { useActiveConnection } from '@/hooks/use-connection';

export function SandboxToolbar({ onRefresh }: { onRefresh?: () => void }) {
  const status = useSandboxState(); // Use computed hook
  const isMutating = useSandboxStore((s) => s.isMutating);
  const stopSandbox = useStopSandbox();
  const { isRemote } = useActiveConnection();

  return (
    <div className="flex items-center justify-between border-b bg-background/95 px-3 py-1.5 backdrop-blur supports-backdrop-filter:bg-background/60">
      <SandboxStatusBadge status={status} />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={status !== 'running' || isMutating}
          className="h-7 px-2"
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          {t('common.refresh')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => stopSandbox.mutate()}
          disabled={status !== 'running' || isMutating}
          className="h-7 px-2 text-destructive hover:text-destructive"
        >
          <Square className="mr-1 h-3.5 w-3.5" />
          {isRemote ? t('common.disconnect') : t('common.stop')}
        </Button>
      </div>
    </div>
  );
}
