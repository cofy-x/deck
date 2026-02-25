/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useState } from 'react';
import { Loader2, Search, ChevronRight } from 'lucide-react';

import { t, currentLocale, setLocale, LANGUAGE_OPTIONS } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ConnectionManager } from '@/components/config/connection-manager';
import { ProviderList } from '@/components/config/provider-list';
import { useConfigStore } from '@/stores/config-store';
import { useModelPreferencesStore } from '@/stores/model-preferences-store';
import { useDebugStore } from '@/stores/debug-store';
import { useConfig, useUpdateConfig, useProviders } from '@/hooks/use-config';
import type { FlatModel } from '@/hooks/use-config';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field row
// ---------------------------------------------------------------------------

function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <Label className="text-sm">{label}</Label>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model toggle section (collapsible per-provider, with search)
// ---------------------------------------------------------------------------

function ModelToggleProviderGroup({
  providerName,
  providerConnected,
  models,
}: {
  providerID: string;
  providerName: string;
  providerConnected: boolean;
  models: FlatModel[];
}) {
  const [expanded, setExpanded] = useState(false);
  // Subscribe to the DATA array so the component re-renders on changes.
  const userModels = useModelPreferencesStore((s) => s.user);
  const setModelVisibility = useModelPreferencesStore(
    (s) => s.setModelVisibility,
  );

  const isVisible = useCallback(
    (providerID: string, modelID: string) => {
      const entry = userModels.find(
        (u) => u.providerID === providerID && u.modelID === modelID,
      );
      return entry?.visibility === 'show';
    },
    [userModels],
  );

  const visibleCount = models.filter((fm) =>
    isVisible(fm.providerID, fm.model.id),
  ).length;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50">
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 transition-transform',
            expanded && 'rotate-90',
          )}
        />
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
            providerConnected ? 'bg-green-500' : 'bg-muted-foreground/40',
          )}
        />
        <span className="font-medium flex-1 text-left">{providerName}</span>
        <span className="text-muted-foreground">
          {visibleCount}/{models.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 border-l pl-2">
          {models.map((fm) => {
            const visible = isVisible(fm.providerID, fm.model.id);
            return (
              <div
                key={fm.key}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/50',
                  !providerConnected && 'opacity-50',
                )}
              >
                <span className="text-xs truncate">{fm.model.name}</span>
                <Switch
                  checked={visible}
                  onCheckedChange={(checked) =>
                    setModelVisibility(
                      fm.providerID,
                      fm.model.id,
                      checked ? 'show' : 'hide',
                    )
                  }
                  disabled={!providerConnected}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ModelTogglesSection() {
  const { models, data: providersData } = useProviders();
  const [search, setSearch] = useState('');

  const connected = providersData?.connected ?? new Set<string>();

  if (models.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('config.no_models_available')}
      </p>
    );
  }

  // Filter by search, exclude deprecated, sort connected providers first
  const filtered = models
    .filter((fm) => {
      if (fm.model.status === 'deprecated') return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        fm.model.name.toLowerCase().includes(q) ||
        fm.providerName.toLowerCase().includes(q) ||
        fm.model.id.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aConn = connected.has(a.providerID) ? 0 : 1;
      const bConn = connected.has(b.providerID) ? 0 : 1;
      if (aConn !== bConn) return aConn - bConn;
      const provCmp = a.providerName.localeCompare(b.providerName);
      if (provCmp !== 0) return provCmp;
      return a.model.name.localeCompare(b.model.name);
    });

  // Group by provider (preserving sorted order)
  const grouped = new Map<string, FlatModel[]>();
  for (const fm of filtered) {
    const existing = grouped.get(fm.providerID);
    if (existing) {
      existing.push(fm);
    } else {
      grouped.set(fm.providerID, [fm]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t('config.search_models')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 pl-7 text-xs"
        />
      </div>
      <div className="max-h-[280px] overflow-y-auto rounded-md border p-1">
        <div className="flex flex-col gap-0.5">
          {grouped.size === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {t('config.no_models_match')}
            </p>
          ) : (
            Array.from(grouped.entries()).map(
              ([providerID, providerModels]) => (
                <ModelToggleProviderGroup
                  key={providerID}
                  providerID={providerID}
                  providerName={providerModels[0]?.providerName ?? providerID}
                  providerConnected={connected.has(providerID)}
                  models={providerModels}
                />
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Sheet
// ---------------------------------------------------------------------------

export function SettingsSheet() {
  const open = useConfigStore((s) => s.settingsOpen);
  const closeSettings = useConfigStore((s) => s.closeSettings);

  const { data: config, isLoading: configLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const {
    providers,
    data: providersData,
    isLoading: providersLoading,
  } = useProviders();

  const connected = providersData?.connected ?? new Set<string>();

  const debugEnabled = useDebugStore((s) => s.enabled);
  const setDebugEnabled = useDebugStore((s) => s.setEnabled);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleShareChange = useCallback(
    (value: string) => {
      updateConfig.mutate({
        share: value as 'manual' | 'auto' | 'disabled',
      });
    },
    [updateConfig],
  );

  const handleSnapshotToggle = useCallback(
    (checked: boolean) => {
      updateConfig.mutate({ snapshot: checked });
    },
    [updateConfig],
  );

  const handleCompactionToggle = useCallback(
    (checked: boolean) => {
      updateConfig.mutate({ compaction: { auto: checked } });
    },
    [updateConfig],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Sheet open={open} onOpenChange={(v) => !v && closeSettings()}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>{t('config.settings_title')}</SheetTitle>
          <SheetDescription>
            {t('config.settings_description')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 p-4">
            {configLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* --- Model Visibility --- */}
                <SettingsSection title={t('config.manage_models')}>
                  <p className="text-xs text-muted-foreground">
                    {t('config.manage_models_description')}
                  </p>
                  <ModelTogglesSection />
                </SettingsSection>

                <Separator />

                {/* --- Providers --- */}
                <SettingsSection title={t('config.providers')}>
                  <ProviderList
                    providers={providers}
                    connected={connected}
                    isLoading={providersLoading}
                  />
                </SettingsSection>

                <Separator />

                {/* --- Connections --- */}
                <SettingsSection title={t('config.connections')}>
                  <ConnectionManager />
                </SettingsSection>

                <Separator />

                {/* --- General Settings --- */}
                <SettingsSection title={t('config.general')}>
                  {/* Keep only Deck-relevant runtime settings in serve mode. */}
                  <FieldRow
                    label={t('config.snapshot')}
                    description={t('config.snapshot_description')}
                  >
                    <Switch
                      checked={config?.snapshot ?? false}
                      onCheckedChange={handleSnapshotToggle}
                    />
                  </FieldRow>

                  <FieldRow
                    label={t('config.share')}
                    description={t('config.share_description')}
                  >
                    <Select
                      value={config?.share ?? 'manual'}
                      onValueChange={handleShareChange}
                    >
                      <SelectTrigger size="sm" className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">{t('config.share_manual')}</SelectItem>
                        <SelectItem value="auto">{t('config.share_auto')}</SelectItem>
                        <SelectItem value="disabled">{t('config.share_disabled')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <FieldRow
                    label={t('config.auto_compaction')}
                    description={t('config.auto_compaction_description')}
                  >
                    <Switch
                      checked={config?.compaction?.auto ?? false}
                      onCheckedChange={handleCompactionToggle}
                    />
                  </FieldRow>

                  <FieldRow
                    label={t('config.language')}
                    description={t('config.language_description')}
                  >
                    <div className="flex gap-1">
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          variant={
                            currentLocale() === opt.value
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setLocale(opt.value);
                            window.location.reload();
                          }}
                        >
                          {opt.nativeName}
                        </Button>
                      ))}
                    </div>
                  </FieldRow>
                </SettingsSection>

                <Separator />

                {/* --- Developer --- */}
                <SettingsSection title={t('config.developer')}>
                  <FieldRow
                    label={t('config.debug_mode')}
                    description={t('config.debug_mode_description')}
                  >
                    <Switch
                      checked={debugEnabled}
                      onCheckedChange={setDebugEnabled}
                    />
                  </FieldRow>
                </SettingsSection>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
