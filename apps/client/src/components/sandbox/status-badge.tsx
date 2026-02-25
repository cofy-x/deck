/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { Badge } from '@/components/ui/badge';
import type { SandboxStatusValue } from '@/stores/sandbox-store';
import type { BrainStatus } from '@/stores/chat-store';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Sandbox Status Badge
// ---------------------------------------------------------------------------

function assertNever(value: never): never {
  throw new Error(`Unhandled status: ${String(value)}`);
}

function getSandboxStatusConfig(status: SandboxStatusValue): {
  label: string;
  dotClass: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (status) {
    case 'idle':
      return {
        label: t('sandbox.status_idle'),
        dotClass: 'bg-muted-foreground',
        variant: 'outline',
      };
    case 'checking':
      return {
        label: t('sandbox.status_checking'),
        dotClass: 'bg-yellow-500',
        variant: 'secondary',
      };
    case 'connecting':
      return {
        label: t('sandbox.status_connecting'),
        dotClass: 'bg-blue-500 animate-pulse',
        variant: 'secondary',
      };
    case 'pulling':
      return {
        label: t('sandbox.status_pulling'),
        dotClass: 'bg-yellow-500 animate-pulse',
        variant: 'secondary',
      };
    case 'starting':
      return {
        label: t('sandbox.status_starting'),
        dotClass: 'bg-yellow-500 animate-pulse',
        variant: 'secondary',
      };
    case 'running':
      return {
        label: t('sandbox.status_running'),
        dotClass: 'bg-green-500',
        variant: 'default',
      };
    case 'stopping':
      return {
        label: t('sandbox.status_stopping'),
        dotClass: 'bg-orange-500 animate-pulse',
        variant: 'secondary',
      };
    case 'error':
      return {
        label: t('sandbox.status_error'),
        dotClass: 'bg-red-500',
        variant: 'destructive',
      };
    default:
      return assertNever(status);
  }
}

export function SandboxStatusBadge({ status }: { status: SandboxStatusValue }) {
  const config = getSandboxStatusConfig(status);
  return (
    <Badge variant={config.variant} className="gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', config.dotClass)} />
      {config.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Brain Status Badge
// ---------------------------------------------------------------------------

function getBrainStatusConfig(status: BrainStatus): {
  label: string;
  dotClass: string;
} {
  switch (status) {
    case 'idle':
      return { label: t('sandbox.brain_idle'), dotClass: 'bg-muted-foreground' };
    case 'thinking':
      return { label: t('sandbox.brain_thinking'), dotClass: 'bg-blue-500 animate-pulse' };
    case 'executing':
      return {
        label: t('sandbox.brain_executing'),
        dotClass: 'bg-amber-500 animate-pulse',
      };
    case 'busy':
      return { label: t('sandbox.brain_busy'), dotClass: 'bg-amber-500 animate-pulse' };
    case 'retry':
      return { label: t('sandbox.brain_retry'), dotClass: 'bg-blue-500 animate-pulse' };
    default:
      return assertNever(status);
  }
}

export function BrainStatusBadge({ status }: { status: BrainStatus }) {
  const config = getBrainStatusConfig(status);
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', config.dotClass)} />
      {config.label}
    </Badge>
  );
}
