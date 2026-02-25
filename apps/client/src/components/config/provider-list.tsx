/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback } from 'react';
import {
  ChevronRight,
  Brain,
  Paperclip,
  Thermometer,
  Wrench,
  Loader2,
  Link,
  Unlink,
  Search,
  Plus,
} from 'lucide-react';
import type { Provider, Model } from '@opencode-ai/sdk/v2/client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ProviderAuthDialog } from '@/components/config/provider-auth-dialog';
import { CustomProviderDialog } from '@/components/config/custom-provider-dialog';
import { useRemoveAuth } from '@/hooks/use-config';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderListProps {
  providers: Provider[];
  connected: Set<string>;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Model row (inside a collapsed provider)
// ---------------------------------------------------------------------------

function ModelRow({ model }: { model: Model }) {
  const caps = model.capabilities;
  const costLabel =
    model.cost.input > 0 || model.cost.output > 0
      ? `$${model.cost.input.toFixed(2)}/$${model.cost.output.toFixed(2)}`
      : t('common.free');

  return (
    <div className="flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs hover:bg-muted/50">
      <span className="min-w-0 flex-1 truncate">{model.name}</span>

      {/* Capability icons */}
      <div className="flex items-center gap-0.5">
        {caps.reasoning && <Brain className="h-3 w-3 text-purple-400" />}
        {caps.attachment && <Paperclip className="h-3 w-3 text-blue-400" />}
        {caps.temperature && (
          <Thermometer className="h-3 w-3 text-orange-400" />
        )}
        {caps.toolcall && <Wrench className="h-3 w-3 text-green-400" />}
      </div>

      {/* Status badge */}
      {model.status !== 'active' && (
        <Badge
          variant={
            model.status === 'deprecated'
              ? 'destructive'
              : model.status === 'beta'
                ? 'secondary'
                : 'outline'
          }
          className="text-[10px] px-1 py-0"
        >
          {model.status}
        </Badge>
      )}

      {/* Cost */}
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {costLabel}
      </span>

      {/* Context limit */}
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {Math.round(model.limit.context / 1000)}k ctx
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider card
// ---------------------------------------------------------------------------

function ProviderCard({
  provider,
  isConnected,
  onConnect,
  onDisconnect,
}: {
  provider: Provider;
  isConnected: boolean;
  onConnect: (providerID: string, providerName: string) => void;
  onDisconnect: (providerID: string, providerName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const modelCount = Object.keys(provider.models).length;
  const models = Object.values(provider.models).filter(
    (m) => m.status !== 'deprecated',
  );

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="flex items-center gap-0.5">
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-muted/50">
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              expanded && 'rotate-90',
            )}
          />
          <span
            className={cn(
              'inline-block h-2 w-2 shrink-0 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-muted-foreground/40',
            )}
          />
          <span className="font-medium">{provider.name}</span>
          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
            {modelCount} model{modelCount !== 1 ? 's' : ''}
          </Badge>
        </CollapsibleTrigger>
        {isConnected ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onDisconnect(provider.id, provider.name)}
          >
            <Unlink className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 text-xs text-primary"
            onClick={() => onConnect(provider.id, provider.name)}
          >
            <Link className="h-3 w-3" />
            <span>{t('common.connect')}</span>
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <div className="ml-5 border-l pl-2">
          {models.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t('provider.no_active_models')}
            </p>
          ) : (
            models.map((model) => <ModelRow key={model.id} model={model} />)
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Provider List
// ---------------------------------------------------------------------------

export function ProviderList({
  providers,
  connected,
  isLoading,
}: ProviderListProps) {
  const [authTarget, setAuthTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [customProviderOpen, setCustomProviderOpen] = useState(false);
  const [search, setSearch] = useState('');
  const removeAuth = useRemoveAuth();

  const handleConnect = useCallback(
    (providerID: string, providerName: string) => {
      setAuthTarget({ id: providerID, name: providerName });
    },
    [],
  );

  const handleDisconnect = useCallback(
    (providerID: string, providerName: string) => {
      removeAuth.mutate({ providerID, providerName });
    },
    [removeAuth],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t('provider.no_providers')}
      </p>
    );
  }

  // Filter by search
  const filtered = providers.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
  });

  // Sort: connected first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    const aConn = connected.has(a.id);
    const bConn = connected.has(b.id);
    if (aConn !== bConn) return aConn ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('provider.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs shrink-0"
            onClick={() => setCustomProviderOpen(true)}
          >
            <Plus className="h-3 w-3" />
            {t('common.custom')}
          </Button>
        </div>
        <div className="max-h-[280px] overflow-y-auto rounded-md border p-1">
          <div className="flex flex-col gap-0.5">
            {sorted.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t('provider.no_match')}
              </p>
            ) : (
              sorted.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  isConnected={connected.has(provider.id)}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Provider auth dialog */}
      {authTarget && (
        <ProviderAuthDialog
          open={!!authTarget}
          onOpenChange={(open) => {
            if (!open) setAuthTarget(null);
          }}
          providerID={authTarget.id}
          providerName={authTarget.name}
        />
      )}

      {/* Custom provider dialog */}
      <CustomProviderDialog
        open={customProviderOpen}
        onOpenChange={setCustomProviderOpen}
      />
    </>
  );
}
