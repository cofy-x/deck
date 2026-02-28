/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Download, CircleX, Check } from 'lucide-react';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSandboxStore } from '@/stores/sandbox-store';
import type { PullLogLayer } from '@/stores/sandbox-store';
import { useCancelSandboxStart } from '@/hooks/use-sandbox';
import { cn } from '@/lib/utils';

function layerStatePercent(status: string): number {
  const s = status.toLowerCase();
  if (s.includes('pull complete') || s.includes('already exists')) return 100;
  if (s.includes('extracting')) return 80;
  if (s.includes('verifying')) return 70;
  if (s.includes('download complete')) return 65;
  if (s.includes('downloading')) return 35;
  if (s.includes('pulling fs layer')) return 5;
  return 0;
}

function layerBarColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pull complete') || s.includes('already exists'))
    return 'bg-green-500';
  if (s.includes('extracting')) return 'bg-yellow-400';
  if (s.includes('downloading')) return 'bg-blue-400';
  return 'bg-[#30363d]';
}

function layerStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pull complete') || s.includes('already exists'))
    return 'text-green-400';
  if (s.includes('download complete') || s.includes('verifying'))
    return 'text-blue-400';
  if (s.includes('downloading') || s.includes('extracting'))
    return 'text-yellow-400';
  if (s.includes('waiting')) return 'text-[#484f58]';
  return 'text-[#c9d1d9]';
}

function LayerRow({ layer }: { layer: PullLogLayer }) {
  const pct = layerStatePercent(layer.status);
  const done = pct === 100;
  const active =
    layer.status.toLowerCase().includes('downloading') ||
    layer.status.toLowerCase().includes('extracting');

  return (
    <div className="flex items-center gap-2 hover:bg-[#161b22] py-px">
      <span className="w-24 shrink-0 font-mono text-[#8b949e]">
        {layer.id}:
      </span>
      <span
        className={cn(
          'w-36 shrink-0 font-mono',
          layerStatusColor(layer.status),
        )}
      >
        {layer.status}
      </span>
      {done ? (
        <Check className="h-3 w-3 shrink-0 text-green-500" />
      ) : (
        <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[#21262d]">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              layerBarColor(layer.status),
              active && 'animate-pulse',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function PullLogViewer() {
  const layers = useSandboxStore((s) => s.pullLogLayers);
  const infoLines = useSandboxStore((s) => s.pullLogInfoLines);
  const percent = useSandboxStore((s) => s.pullPercent);
  const layersDone = useSandboxStore((s) => s.pullLayersDone);
  const layersTotal = useSandboxStore((s) => s.pullLayersTotal);
  const cancelPull = useCancelSandboxStart();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const totalEntries = layers.length + infoLines.length;

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [totalEntries, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  const progressValue = percent ?? 0;

  const headerLines = infoLines.filter(
    (l) =>
      !l.toLowerCase().startsWith('digest:') &&
      !l.toLowerCase().startsWith('status:') &&
      !l.toLowerCase().includes('successfully pulled'),
  );
  const footerLines = infoLines.filter(
    (l) =>
      l.toLowerCase().startsWith('digest:') ||
      l.toLowerCase().startsWith('status:') ||
      l.toLowerCase().includes('successfully pulled'),
  );

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-col gap-2 border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {t('sandbox.pull_log_title')}
            </span>
            {layersTotal > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {t('sandbox.pull_layers')
                  .replace('{done}', String(layersDone))
                  .replace('{total}', String(layersTotal))}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={cancelPull}
          >
            <CircleX className="h-3 w-3" />
            {t('sandbox.cancel_pull')}
          </Button>
        </div>
        <Progress value={progressValue} className="h-1.5 w-full" />
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[#0d1117] px-3 py-2"
        onScroll={handleScroll}
      >
        {totalEntries === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('sandbox.pull_log_waiting')}
          </div>
        ) : (
          <div className="text-[11px] leading-5">
            {/* Header info lines */}
            {headerLines.map((line, i) => (
              <div key={`h-${i}`} className="font-mono text-[#8b949e]">
                {line}
              </div>
            ))}

            {/* Layer rows */}
            {layers.length > 0 && (
              <div className="mt-1">
                {layers.map((layer) => (
                  <LayerRow key={layer.id} layer={layer} />
                ))}
              </div>
            )}

            {/* Footer info lines (Digest, Status, etc.) */}
            {footerLines.length > 0 && (
              <div className="mt-1">
                {footerLines.map((line, i) => (
                  <div key={`f-${i}`} className="font-mono text-[#8b949e]">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scroll-to-bottom */}
      {!autoScroll && (
        <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            onClick={scrollToBottom}
            className="h-6 rounded-full px-3 text-xs shadow-md"
          >
            <ArrowDown className="mr-1 h-3 w-3" />
            {t('log.latest')}
          </Button>
        </div>
      )}
    </div>
  );
}
