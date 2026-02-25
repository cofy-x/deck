/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useMemo } from 'react';
import { Puzzle, FileCode, Wrench } from 'lucide-react';
import { t } from '@/i18n';
import type { McpStatus } from '@opencode-ai/sdk/v2/client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useMcpStatus,
  useLspStatus,
  useFormatterStatus,
} from '@/hooks/use-server-status';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mcpStatusColor(status: McpStatus['status']): string {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'disabled':
      return 'bg-muted-foreground/40';
    case 'failed':
      return 'bg-red-500';
    case 'needs_auth':
    case 'needs_client_registration':
      return 'bg-yellow-500';
    default:
      return 'bg-muted-foreground/40';
  }
}

// ---------------------------------------------------------------------------
// Status pill (single indicator)
// ---------------------------------------------------------------------------

function StatusPill({
  icon: Icon,
  label,
  count,
  total,
  variant,
  onClick,
  ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  total: number;
  variant: 'ok' | 'warn' | 'idle';
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const interactive = !!onClick;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {interactive ? (
            <button
              type="button"
              onClick={onClick}
              aria-label={
                ariaLabel ??
                  t('status.active_count')
                    .replace('{label}', label)
                    .replace('{count}', String(count))
                    .replace('{total}', String(total))
              }
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0 text-[10px] font-normal transition-colors',
                'focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2',
                'hover:bg-muted/60',
                variant === 'ok' && 'border-green-500/30 text-green-400',
                variant === 'warn' && 'border-yellow-500/30 text-yellow-400',
                variant === 'idle' && 'border-muted-foreground/30',
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
              <span>
                {count}/{total}
              </span>
            </button>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                'flex items-center gap-1 px-1.5 py-0 text-[10px] font-normal cursor-default',
                variant === 'ok' && 'border-green-500/30 text-green-400',
                variant === 'warn' && 'border-yellow-500/30 text-yellow-400',
                variant === 'idle' && 'border-muted-foreground/30',
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
              <span>
                {count}/{total}
              </span>
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t('status.active_count')
            .replace('{label}', label)
            .replace('{count}', String(count))
            .replace('{total}', String(total))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// MCP detail popover
// ---------------------------------------------------------------------------

function McpDetailPopover({ servers }: { servers: Record<string, McpStatus> }) {
  const entries = Object.entries(servers);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Show MCP server details"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50"
        >
          <Puzzle className="h-3 w-3" />
          {t('status.mcp')}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2" align="start">
        <p className="mb-2 text-xs font-semibold">{t('status.mcp_servers')}</p>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('status.no_mcp_servers')}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {entries.map(([name, status]) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs"
              >
                <span
                  className={cn(
                    'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                    mcpStatusColor(status.status),
                  )}
                />
                <span className="truncate flex-1">{name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {status.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ServerStatusBar({
  onOpenMcpDialog,
}: {
  onOpenMcpDialog?: () => void;
}) {
  const { data: mcpServers } = useMcpStatus();
  const { data: lspServers } = useLspStatus();
  const { data: formatters } = useFormatterStatus();

  const mcpStats = useMemo(() => {
    if (!mcpServers) return { connected: 0, total: 0 };
    const entries = Object.values(mcpServers);
    return {
      connected: entries.filter((s) => s.status === 'connected').length,
      total: entries.length,
    };
  }, [mcpServers]);

  const lspStats = useMemo(() => {
    if (!lspServers) return { connected: 0, total: 0 };
    return {
      connected: lspServers.filter((s) => s.status === 'connected').length,
      total: lspServers.length,
    };
  }, [lspServers]);

  const fmtStats = useMemo(() => {
    if (!formatters) return { enabled: 0, total: 0 };
    return {
      enabled: formatters.filter((f) => f.enabled).length,
      total: formatters.length,
    };
  }, [formatters]);

  const hasMcp = mcpStats.total > 0;
  const hasLsp = lspStats.total > 0;
  const hasFmt = fmtStats.total > 0;

  if (!hasMcp && !hasLsp && !hasFmt) return null;

  return (
    <div className="flex items-center gap-1">
      {hasMcp && (
        <>
          <StatusPill
            icon={Puzzle}
            label={t('status.mcp')}
            count={mcpStats.connected}
            total={mcpStats.total}
            variant={
              mcpStats.connected === mcpStats.total
                ? 'ok'
                : mcpStats.connected > 0
                  ? 'warn'
                  : 'idle'
            }
            onClick={onOpenMcpDialog}
            ariaLabel="Open MCP server management"
          />
          {mcpServers && <McpDetailPopover servers={mcpServers} />}
        </>
      )}
      {hasLsp && (
        <StatusPill
          icon={FileCode}
          label={t('status.lsp')}
          count={lspStats.connected}
          total={lspStats.total}
          variant={
            lspStats.connected === lspStats.total
              ? 'ok'
              : lspStats.connected > 0
                ? 'warn'
                : 'idle'
          }
        />
      )}
      {hasFmt && (
        <StatusPill
          icon={Wrench}
          label={t('status.formatter')}
          count={fmtStats.enabled}
          total={fmtStats.total}
          variant={
            fmtStats.enabled === fmtStats.total
              ? 'ok'
              : fmtStats.enabled > 0
                ? 'warn'
                : 'idle'
          }
        />
      )}
    </div>
  );
}
