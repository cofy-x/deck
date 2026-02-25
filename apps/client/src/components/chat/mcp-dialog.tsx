/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback } from 'react';
import { Loader2, Plug, PlugZap, AlertCircle } from 'lucide-react';
import { t } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useChatStore } from '@/stores/chat-store';
import { useMcpStatus } from '@/hooks/use-server-status';
import { useMcpToggle } from '@/hooks/use-mcp-toggle';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function McpDialog() {
  const open = useChatStore((s) => s.mcpDialogOpen);
  const setOpen = useChatStore((s) => s.setMcpDialogOpen);
  const requestInputFocus = useChatStore((s) => s.requestInputFocus);
  const { data: mcpStatuses, isLoading } = useMcpStatus();
  const toggle = useMcpToggle();

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setOpen(value);
      if (!value) requestInputFocus();
    },
    [setOpen, requestInputFocus],
  );

  const entries = mcpStatuses ? Object.entries(mcpStatuses) : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap className="h-4 w-4" />
            {t('mcp.title')}
          </DialogTitle>
          <DialogDescription>
            {t('mcp.description')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('mcp.no_servers')}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
            {entries.map(([name, status]) => {
              const isConnected = status.status === 'connected';
              const isFailed =
                status.status === 'failed' ||
                status.status === 'needs_auth' ||
                status.status === 'needs_client_registration';

              return (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md border px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Plug className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {name}
                      </span>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={status.status} />
                        {isFailed && 'error' in status && (
                          <span className="text-[10px] text-destructive truncate max-w-[180px]">
                            {status.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={isConnected}
                    disabled={toggle.isPending}
                    onCheckedChange={(checked) =>
                      toggle.mutate({ name, connect: checked })
                    }
                    aria-label={`Toggle ${name}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'connected':
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1 py-0 text-green-500 border-green-500/30"
        >
          {t('mcp.status_connected')}
        </Badge>
      );
    case 'disabled':
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          {t('mcp.status_disabled')}
        </Badge>
      );
    case 'needs_auth':
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1 py-0 text-yellow-500 border-yellow-500/30"
        >
          {t('mcp.status_needs_auth')}
        </Badge>
      );
    default:
      return (
        <Badge variant="destructive" className="text-[10px] px-1 py-0">
          <AlertCircle className="mr-0.5 h-2.5 w-2.5" />
          {t('mcp.status_failed')}
        </Badge>
      );
  }
}
