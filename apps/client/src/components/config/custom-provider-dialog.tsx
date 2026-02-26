/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback } from 'react';
import { Loader2, Plus, Trash2, Sparkles, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAddCustomProvider } from '@/hooks/use-config';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelEntry {
  id: string;
  name: string;
}

interface HeaderEntry {
  key: string;
  value: string;
}

interface CustomProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PROVIDER_ID_PATTERN = /^[a-z0-9_-]+$/;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomProviderDialog({
  open,
  onOpenChange,
}: CustomProviderDialogProps) {
  const [providerId, setProviderId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<ModelEntry[]>([{ id: '', name: '' }]);
  const [headers, setHeaders] = useState<HeaderEntry[]>([
    { key: '', value: '' },
  ]);

  const addCustomProvider = useAddCustomProvider();

  // -----------------------------------------------------------------------
  // Model list helpers
  // -----------------------------------------------------------------------

  const addModel = useCallback(() => {
    setModels((prev) => [...prev, { id: '', name: '' }]);
  }, []);

  const removeModel = useCallback((index: number) => {
    setModels((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateModel = useCallback(
    (index: number, field: keyof ModelEntry, value: string) => {
      setModels((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
      );
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Header list helpers
  // -----------------------------------------------------------------------

  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { key: '', value: '' }]);
  }, []);

  const removeHeader = useCallback((index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateHeader = useCallback(
    (index: number, field: keyof HeaderEntry, value: string) => {
      setHeaders((prev) =>
        prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
      );
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const isValid =
    providerId.trim() !== '' &&
    PROVIDER_ID_PATTERN.test(providerId.trim()) &&
    baseURL.trim() !== '';

  const handleSubmit = useCallback(() => {
    if (!isValid) return;

    // Build headers map (skip empty entries)
    const headersMap: Record<string, string> = {};
    for (const h of headers) {
      if (h.key.trim() && h.value.trim()) {
        headersMap[h.key.trim()] = h.value.trim();
      }
    }

    addCustomProvider.mutate(
      {
        id: providerId.trim(),
        name: displayName.trim() || providerId.trim(),
        baseURL: baseURL.trim(),
        apiKey: apiKey.trim() || undefined,
        models: models.filter((m) => m.id.trim()),
        headers: Object.keys(headersMap).length > 0 ? headersMap : undefined,
      },
      {
        onSuccess: () => {
          // Reset form
          setProviderId('');
          setDisplayName('');
          setBaseURL('');
          setApiKey('');
          setModels([{ id: '', name: '' }]);
          setHeaders([{ key: '', value: '' }]);
          onOpenChange(false);
        },
      },
    );
  }, [
    isValid,
    providerId,
    displayName,
    baseURL,
    apiKey,
    models,
    headers,
    addCustomProvider,
    onOpenChange,
  ]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t('custom_provider.title')}
          </DialogTitle>
          <DialogDescription>
            {t('custom_provider.description')}{' '}
            <a
              href="https://opencode.ai/docs/providers/#custom-provider"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {t('custom_provider.docs_link')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="flex flex-col gap-4 py-2">
            {/* Provider ID */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider-id">{t('custom_provider.provider_id')}</Label>
              <Input
                id="provider-id"
                placeholder={t('custom_provider.placeholder_id')}
                value={providerId}
                className={cn(
                  providerId ? 'text-foreground' : 'text-muted-foreground',
                )}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => setProviderId(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('custom_provider.provider_id_hint')}
              </p>
            </div>

            {/* Display name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display-name">{t('custom_provider.display_name')}</Label>
              <Input
                id="display-name"
                placeholder={t('custom_provider.placeholder_name')}
                value={displayName}
                className={cn(
                  displayName ? 'text-foreground' : 'text-muted-foreground',
                )}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {/* Base URL */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="base-url">{t('custom_provider.base_url')}</Label>
              <Input
                id="base-url"
                placeholder={t('custom_provider.placeholder_url')}
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                className={cn(
                  baseURL ? 'text-foreground' : 'text-muted-foreground',
                )}
              />
            </div>

            {/* API Key */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-key">{t('custom_provider.api_key')}</Label>
              <Input
                id="api-key"
                type="password"
                placeholder={t('custom_provider.api_key')}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={cn(
                  apiKey ? 'text-foreground' : 'text-muted-foreground',
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('custom_provider.api_key_hint')}
              </p>
            </div>

            <Separator />

            {/* Models */}
            <div className="flex flex-col gap-2">
              <Label>{t('custom_provider.models')}</Label>
              {models.map((model, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="model-id"
                    value={model.id}
                    onChange={(e) => updateModel(index, 'id', e.target.value)}
                    className={cn(
                      "h-8 text-xs flex-1",
                      model.id ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  />
                  <Input
                    placeholder="Display Name"
                    value={model.name}
                    onChange={(e) => updateModel(index, 'name', e.target.value)}
                    className={cn(
                      "h-8 text-xs flex-1",
                      model.name ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => removeModel(index)}
                    disabled={models.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 justify-start gap-1 px-2 text-xs text-primary"
                onClick={addModel}
              >
                <Plus className="h-3 w-3" />
                {t('custom_provider.add_model')}
              </Button>
            </div>

            <Separator />

            {/* Headers */}
            <div className="flex flex-col gap-2">
              <Label>{t('custom_provider.headers')}</Label>
              {headers.map((header, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Header-Name"
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    className={cn(
                      "h-8 text-xs flex-1",
                      header.key ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  />
                  <Input
                    placeholder="value"
                    value={header.value}
                    onChange={(e) =>
                      updateHeader(index, 'value', e.target.value)
                    }
                    className={cn(
                      "h-8 text-xs flex-1",
                      header.value ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => removeHeader(index)}
                    disabled={headers.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 justify-start gap-1 px-2 text-xs text-primary"
                onClick={addHeader}
              >
                <Plus className="h-3 w-3" />
                {t('custom_provider.add_header')}
              </Button>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || addCustomProvider.isPending}
          >
            {addCustomProvider.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('common.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
