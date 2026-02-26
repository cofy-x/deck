/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ChevronsUpDown,
  Check,
  Brain,
  Paperclip,
  Thermometer,
  Wrench,
  Settings2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProviders } from '@/hooks/use-config';
import type { FlatModel } from '@/hooks/use-config';
import { useModelPreferencesStore } from '@/stores/model-preferences-store';
import { useConfigStore } from '@/stores/config-store';
import { useChatStore } from '@/stores/chat-store';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Model validation hook
// ---------------------------------------------------------------------------

/**
 * Validates that the stored recent[0] model still exists among the currently
 * available (connected) providers. If not, auto-selects the first available
 * connected model to avoid sending requests to an unauthenticated provider.
 */
function useValidateStoredModel(models: FlatModel[]) {
  const recentModels = useModelPreferencesStore((s) => s.recent);
  const selectModel = useModelPreferencesStore((s) => s.selectModel);
  const reset = useModelPreferencesStore((s) => s.reset);

  useEffect(() => {
    // Only validate after models have loaded
    if (models.length === 0) return;

    const active = recentModels[0];
    if (!active) return;

    const activeKey = `${active.providerID}/${active.modelID}`;
    const exists = models.some(
      (fm) => fm.key === activeKey && fm.providerConnected,
    );

    if (!exists) {
      // Current model/provider no longer available — pick the first connected model
      const fallback = models.find((fm) => fm.providerConnected);
      if (fallback) {
        console.warn(
          `[ModelSelector] Stored model "${activeKey}" no longer available. Falling back to "${fallback.key}".`,
        );
        selectModel(fallback.providerID, fallback.model.id);
      } else {
        // No connected providers at all — clear stale selection to avoid
        // sending requests to an unauthenticated provider.
        console.warn(
          `[ModelSelector] No connected providers found. Clearing stale model selection.`,
        );
        reset();
      }
    }
  }, [models, recentModels, selectModel, reset]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group flat models by provider. */
function groupByProvider(models: FlatModel[]): Map<string, FlatModel[]> {
  const grouped = new Map<string, FlatModel[]>();
  for (const fm of models) {
    const existing = grouped.get(fm.providerID);
    if (existing) {
      existing.push(fm);
    } else {
      grouped.set(fm.providerID, [fm]);
    }
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Capability icons
// ---------------------------------------------------------------------------

function CapabilityIcons({ fm }: { fm: FlatModel }) {
  const caps = fm.model.capabilities;
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5">
        {caps.reasoning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Brain className="h-3 w-3 text-purple-400" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t('model.cap_reasoning')}
            </TooltipContent>
          </Tooltip>
        )}
        {caps.attachment && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Paperclip className="h-3 w-3 text-blue-400" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t('model.cap_attachments')}
            </TooltipContent>
          </Tooltip>
        )}
        {caps.temperature && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Thermometer className="h-3 w-3 text-orange-400" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t('model.cap_temperature')}
            </TooltipContent>
          </Tooltip>
        )}
        {caps.toolcall && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Wrench className="h-3 w-3 text-green-400" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t('model.cap_toolcall')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return null;
  const variant =
    status === 'deprecated'
      ? 'destructive'
      : status === 'beta'
        ? 'secondary'
        : 'outline';
  return (
    <Badge variant={variant} className="ml-auto text-[10px] px-1 py-0">
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Model Selector
// ---------------------------------------------------------------------------

interface ModelSelectorProps {
  /** Optional CSS class name for the root element. */
  className?: string;
  /** When true render a full-width variant (for use inside the settings panel). */
  fullWidth?: boolean;
}

export function ModelSelector({ className, fullWidth }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const { models } = useProviders();

  // Validate stored model against current providers on load
  useValidateStoredModel(models);

  // Support programmatic opening via chat store (/model command)
  const externalOpen = useChatStore((s) => s.modelSelectorOpen);
  const setExternalOpen = useChatStore((s) => s.setModelSelectorOpen);
  const requestInputFocus = useChatStore((s) => s.requestInputFocus);
  const didOpenExternal = useRef(false);

  useEffect(() => {
    if (externalOpen && !didOpenExternal.current) {
      didOpenExternal.current = true;
      setOpen(true);
      setExternalOpen(false);
    } else if (!externalOpen) {
      didOpenExternal.current = false;
    }
  }, [externalOpen, setExternalOpen]);

  // When popover closes after being opened via command, refocus the input
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      requestInputFocus();
    }
  }, [open, requestInputFocus]);

  // Subscribe to actual DATA arrays so the component re-renders when they change.
  // (Using function selectors like `s.isModelVisible` would return a stable ref
  // and never trigger re-renders.)
  const userModels = useModelPreferencesStore((s) => s.user);
  const recentModels = useModelPreferencesStore((s) => s.recent);
  const selectModel = useModelPreferencesStore((s) => s.selectModel);
  const openSettings = useConfigStore((s) => s.openSettings);

  // Current active model key from recent[0]
  const currentModelKey = useMemo(() => {
    const first = recentModels[0];
    return first ? `${first.providerID}/${first.modelID}` : undefined;
  }, [recentModels]);

  // Determine the display label for the trigger button
  const triggerLabel = useMemo(() => {
    if (!currentModelKey) return t('model.select');
    const match = models.find((fm) => fm.key === currentModelKey);
    if (match) return match.model.name;
    const slashIdx = currentModelKey.indexOf('/');
    return slashIdx > 0 ? currentModelKey.slice(slashIdx + 1) : currentModelKey;
  }, [currentModelKey, models]);

  // Build the list of models to display in the dropdown.
  // If user has curated models, only show those with visibility "show" + connected.
  // Otherwise (fresh install), show all connected non-deprecated models as fallback.
  const filteredModels = useMemo(() => {
    const hasCurated = userModels.length > 0;

    return models
      .filter((fm) => fm.model.status !== 'deprecated')
      .filter((fm) => {
        if (!hasCurated) {
          // Fallback: show all connected models
          return fm.providerConnected;
        }
        // Only models in user list with visibility "show"
        const entry = userModels.find(
          (u) => u.providerID === fm.providerID && u.modelID === fm.model.id,
        );
        return entry?.visibility === 'show';
      })
      .filter((fm) => fm.providerConnected)
      .sort((a, b) => {
        const provCmp = a.providerName.localeCompare(b.providerName);
        if (provCmp !== 0) return provCmp;
        return a.model.name.localeCompare(b.model.name);
      });
  }, [models, userModels]);

  const grouped = useMemo(
    () => groupByProvider(filteredModels),
    [filteredModels],
  );

  const handleSelect = useCallback(
    (fm: FlatModel) => {
      selectModel(fm.providerID, fm.model.id);
      setOpen(false);
    },
    [selectModel],
  );

  const handleManageModels = useCallback(() => {
    setOpen(false);
    openSettings();
  }, [openSettings]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'justify-between gap-1 text-xs font-normal',
            fullWidth ? 'w-full' : 'h-7 max-w-[200px] px-2',
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0"
        align={fullWidth ? 'center' : 'start'}
      >
        <Command>
          <CommandInput placeholder={t('model.search')} />
          <CommandList>
            <CommandEmpty>{t('model.no_models')}</CommandEmpty>
            {Array.from(grouped.entries()).map(
              ([providerID, providerModels]) => {
                const providerName =
                  providerModels[0]?.providerName ?? providerID;
                return (
                  <CommandGroup
                    key={providerID}
                    heading={
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                        {providerName}
                      </span>
                    }
                  >
                    {providerModels.map((fm) => {
                      const isActive = fm.key === currentModelKey;
                      return (
                        <CommandItem
                          key={fm.key}
                          value={`${fm.providerName} ${fm.model.name} ${fm.model.id}`}
                          onSelect={() => handleSelect(fm)}
                          className="flex items-center gap-2"
                        >
                          <Check
                            className={cn(
                              'h-3.5 w-3.5 shrink-0',
                              isActive ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate text-sm">
                              {fm.model.name}
                            </span>
                            <CapabilityIcons fm={fm} />
                            <StatusBadge status={fm.model.status} />
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              },
            )}

            {/* Manage models shortcut */}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={handleManageModels}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="text-xs">{t('model.manage')}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
