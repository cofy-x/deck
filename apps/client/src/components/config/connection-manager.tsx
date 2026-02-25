/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';

import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  useConnectionStore,
  type ConnectionProfile,
} from '@/stores/connection-store';
import { useActiveConnection } from '@/hooks/use-connection';
import {
  RemoteConnectionDialog,
  type RemoteConnectionFormData,
} from '@/components/config/remote-connection-dialog';
import type { RemoteConnectionInput } from '@/lib/connection-validation';
import { useTransientFlag } from '@/hooks/use-transient-flag';
import { useSandboxState, useStartSandbox } from '@/hooks/use-sandbox';

const SAVE_FEEDBACK_DURATION_MS = 1500;

type DialogState =
  | { open: false }
  | { open: true; mode: 'create' | 'edit'; profile?: ConnectionProfile };

const CLOSED_DIALOG: DialogState = { open: false };

function toFormData(profile: ConnectionProfile): RemoteConnectionFormData {
  return {
    name: profile.name,
    opencodeBaseUrl: profile.opencodeBaseUrl,
    daemonBaseUrl: profile.daemonBaseUrl,
    noVncUrl: profile.noVncUrl,
    webTerminalUrl: profile.webTerminalUrl,
  };
}

export function ConnectionManager() {
  const profiles = useConnectionStore((s) => s.profiles);
  const activeProfileId = useConnectionStore((s) => s.activeProfileId);
  const createRemoteProfile = useConnectionStore((s) => s.createRemoteProfile);
  const updateProfile = useConnectionStore((s) => s.updateProfile);
  const removeProfile = useConnectionStore((s) => s.removeProfile);
  const setActiveProfile = useConnectionStore((s) => s.setActiveProfile);
  const setSecrets = useConnectionStore((s) => s.setSecrets);
  const clearSecrets = useConnectionStore((s) => s.clearSecrets);
  const { profile: activeProfile, secrets } = useActiveConnection();
  const [dialogState, setDialogState] = useState<DialogState>(CLOSED_DIALOG);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [daemonToken, setDaemonToken] = useState('');
  const [reconnectAfterSave, setReconnectAfterSave] = useState(false);
  const sandboxStatus = useSandboxState();
  const startSandbox = useStartSandbox();
  const {
    active: saveFeedbackVisible,
    trigger: triggerSaveFeedback,
    clear: clearSaveFeedback,
  } = useTransientFlag(SAVE_FEEDBACK_DURATION_MS);

  useEffect(() => {
    setUsername(secrets.opencodeUsername ?? '');
    setPassword(secrets.opencodePassword ?? '');
    setDaemonToken(secrets.daemonToken ?? '');
  }, [activeProfile.id, secrets]);

  useEffect(() => {
    clearSaveFeedback();
  }, [activeProfile.id, clearSaveFeedback]);

  useEffect(() => {
    if (!reconnectAfterSave) return;
    if (activeProfile.type !== 'remote') {
      setReconnectAfterSave(false);
      return;
    }
    if (sandboxStatus !== 'error') {
      setReconnectAfterSave(false);
      return;
    }
    if (startSandbox.isPending) return;
    startSandbox.mutate(undefined, {
      onSettled: () => setReconnectAfterSave(false),
    });
  }, [reconnectAfterSave, activeProfile.type, sandboxStatus, startSandbox]);

  const sortedProfiles = useMemo(
    () =>
      [...profiles].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'local' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [profiles],
  );

  const openCreateDialog = () => {
    setDialogState({ open: true, mode: 'create' });
  };

  const openEditDialog = (profile: ConnectionProfile) => {
    setDialogState({ open: true, mode: 'edit', profile });
  };

  const closeDialog = () => {
    setDialogState(CLOSED_DIALOG);
  };

  const handleDialogSubmit = (input: RemoteConnectionInput) => {
    if (!dialogState.open) return;

    if (dialogState.mode === 'create') {
      const profile = createRemoteProfile(input);
      setActiveProfile(profile.id);
    } else if (dialogState.profile) {
      updateProfile(dialogState.profile.id, {
        name: input.name,
        opencodeBaseUrl: input.opencodeBaseUrl,
        daemonBaseUrl: input.daemonBaseUrl,
        noVncUrl: input.noVncUrl,
        webTerminalUrl: input.webTerminalUrl,
      });
    }
    closeDialog();
  };

  const handleSaveSecrets = () => {
    setSecrets(activeProfile.id, {
      opencodeUsername: username.trim() || undefined,
      opencodePassword: password || undefined,
      daemonToken: daemonToken.trim() || undefined,
    });
    triggerSaveFeedback();
    if (activeProfile.type === 'remote' && sandboxStatus === 'error') {
      setReconnectAfterSave(true);
    }
  };

  const handleClearSecrets = () => {
    clearSecrets(activeProfile.id);
    setUsername('');
    setPassword('');
    setDaemonToken('');
    clearSaveFeedback();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t('connection.description')}
        </p>
        <Button size="sm" variant="outline" onClick={openCreateDialog}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('connection.add_remote')}
        </Button>
      </div>

      <div className="flex flex-col gap-1 rounded-md border p-1">
        {sortedProfiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          return (
            <div
              key={profile.id}
              className={cn(
                'flex items-center justify-between rounded-md px-2 py-1.5',
                isActive ? 'bg-muted' : 'hover:bg-muted/50',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setActiveProfile(profile.id)}
              >
                <span className="truncate text-xs font-medium">
                  {profile.name}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {profile.type === 'remote' ? t('common.remote') : t('common.local')}
                </span>
                {isActive ? <Check className="h-3.5 w-3.5 text-green-500" /> : null}
              </button>

              {profile.type === 'remote' ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => openEditDialog(profile)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => removeProfile(profile.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-3">
        <div>
          <h4 className="text-xs font-medium">{t('connection.credentials_title')}</h4>
          <p className="text-[11px] text-muted-foreground">
            {t('connection.credentials_description')}
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="conn-username">{t('connection.opencode_username')}</Label>
          <Input
            id="conn-username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              clearSaveFeedback();
            }}
            placeholder={t('connection.placeholder_username')}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className={cn(
              'placeholder:text-current',
              username ? 'text-foreground' : 'text-muted-foreground',
            )}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="conn-password">{t('connection.opencode_password')}</Label>
          <Input
            id="conn-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearSaveFeedback();
            }}
            placeholder={t('connection.placeholder_password')}
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className={cn(
              'placeholder:text-current',
              password ? 'text-foreground' : 'text-muted-foreground',
            )}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="conn-daemon-token">{t('connection.daemon_token')}</Label>
          <Input
            id="conn-daemon-token"
            type="password"
            value={daemonToken}
            onChange={(event) => {
              setDaemonToken(event.target.value);
              clearSaveFeedback();
            }}
            placeholder={t('connection.placeholder_optional')}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className={cn(
              'placeholder:text-current',
              daemonToken ? 'text-foreground' : 'text-muted-foreground',
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="relative min-w-[76px]"
            onClick={handleSaveSecrets}
            aria-live="polite"
          >
            <span
              className={cn(
                'transition-all duration-200',
                saveFeedbackVisible ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
              )}
            >
              {t('common.save')}
            </span>
            <Check
              className={cn(
                'pointer-events-none absolute inset-0 m-auto h-4 w-4 transition-all duration-200',
                saveFeedbackVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
              )}
            />
          </Button>
          <Button size="sm" variant="outline" onClick={handleClearSecrets}>
            {t('common.clear')}
          </Button>
        </div>
      </div>

      <RemoteConnectionDialog
        open={dialogState.open}
        mode={dialogState.open ? dialogState.mode : 'create'}
        initialData={
          dialogState.open && dialogState.mode === 'edit' && dialogState.profile
            ? toFormData(dialogState.profile)
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
