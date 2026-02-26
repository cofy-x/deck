/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback, useMemo } from 'react';
import { Loader2, Key, ExternalLink } from 'lucide-react';
import type { ProviderAuthMethod } from '@opencode-ai/sdk/v2/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSetAuth, useProviderAuthMethods } from '@/hooks/use-config';
import { useOpenCodeClient } from '@/hooks/use-opencode-client';
import { unwrap } from '@/lib/opencode';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerID: string;
  providerName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProviderAuthDialog({
  open,
  onOpenChange,
  providerID,
  providerName,
}: ProviderAuthDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const setAuth = useSetAuth();
  const { data: authMethods } = useProviderAuthMethods();
  const client = useOpenCodeClient();

  const methods: ProviderAuthMethod[] = useMemo(
    () => authMethods?.[providerID] ?? [],
    [authMethods, providerID],
  );
  // Always show API key input as fallback — most providers accept API keys
  // even when the auth methods endpoint doesn't explicitly list one.
  const hasApiMethod = true;
  const oauthMethod = methods.find((m) => m.type === 'oauth');

  const validateApiKey = useCallback(
    (key: string): string | null => {
      const trimmed = key.trim();

      if (trimmed !== key) return t('provider_auth.key_has_spaces');
      if (trimmed.length < 20) return t('provider_auth.key_too_short');

      // Provider-specific checks
      if (providerID === 'openai' && !trimmed.startsWith('sk-')) {
        return t('provider_auth.openai_prefix');
      }

      return null; // Valid
    },
    [providerID],
  );

  const handleSaveApiKey = useCallback(() => {
    if (!apiKey.trim()) return;

    const validationError = validateApiKey(apiKey);
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    setAuthError(null);
    setAuth.mutate(
      {
        providerID,
        providerName,
        auth: { type: 'api', key: apiKey.trim() },
      },
      {
        onSuccess: () => {
          setApiKey('');
          onOpenChange(false);
        },
      },
    );
  }, [apiKey, providerID, providerName, setAuth, onOpenChange, validateApiKey]);

  const handleOAuth = useCallback(async () => {
    if (!client || !oauthMethod) return;
    setAuthError(null);
    setOauthLoading(true);
    try {
      const methodIndex = methods.indexOf(oauthMethod);
      const result = await client.provider.oauth.authorize({
        providerID,
        method: methodIndex,
      });
      const data = unwrap(result);
      if (data && typeof data === 'object' && 'url' in data) {
        window.open((data as { url: string }).url, '_blank');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'OAuth authorization failed';
      setAuthError(message);
      console.error('[ProviderAuthDialog] OAuth error:', error);
    } finally {
      setOauthLoading(false);
    }
  }, [client, oauthMethod, methods, providerID]);

  const handleClose = useCallback(() => {
    setApiKey('');
    setAuthError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('provider_auth.title').replace('{name}', providerName)}</DialogTitle>
          <DialogDescription>
            {t('provider_auth.description').replace('{name}', providerName)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* API Key method */}
          {hasApiMethod && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="api-key" className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                {t('provider_auth.api_key')}
              </Label>
              <Input
                id="api-key"
                type="password"
                placeholder={t('provider_auth.api_key_placeholder')}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveApiKey();
                }}
                className={cn(
                  apiKey ? 'text-foreground' : 'text-muted-foreground',
                )}
              />
            </div>
          )}

          {/* OAuth method */}
          {oauthMethod && (
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                {oauthMethod.label}
              </Label>
              <Button
                variant="outline"
                onClick={() => void handleOAuth()}
                disabled={oauthLoading}
              >
                {oauthLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                {t('provider_auth.authorize_oauth')}
              </Button>
            </div>
          )}

          {/* Error display */}
          {authError && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {authError}
            </div>
          )}

          {/* Env var hint when auth methods are available */}
          {methods.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('provider_auth.env_hint')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          {hasApiMethod && (
            <Button
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim() || setAuth.isPending}
            >
              {setAuth.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('common.save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
