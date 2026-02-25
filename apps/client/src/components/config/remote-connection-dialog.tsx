/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { t } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  remoteConnectionInputSchema,
  type RemoteConnectionInput,
} from '@/lib/connection-validation';

export interface RemoteConnectionFormData {
  name: string;
  opencodeBaseUrl: string;
  daemonBaseUrl?: string;
  noVncUrl?: string;
  webTerminalUrl?: string;
}

interface RemoteConnectionDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: RemoteConnectionFormData;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: RemoteConnectionInput) => void;
}

const EMPTY_FORM: RemoteConnectionFormData = {
  name: '',
  opencodeBaseUrl: '',
  daemonBaseUrl: '',
  noVncUrl: '',
  webTerminalUrl: '',
};

export function RemoteConnectionDialog(props: RemoteConnectionDialogProps) {
  const [form, setForm] = useState<RemoteConnectionFormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setForm(props.initialData ?? EMPTY_FORM);
    setError(null);
  }, [props.open, props.initialData]);

  const title =
    props.mode === 'create' ? t('remote_dialog.add_title') : t('remote_dialog.edit_title');
  const actionLabel = props.mode === 'create' ? t('common.create') : t('common.save');

  const hasChanges = useMemo(() => {
    if (props.mode === 'create') {
      return !!form.name.trim() || !!form.opencodeBaseUrl.trim();
    }
    const initial = props.initialData ?? EMPTY_FORM;
    return (
      form.name !== initial.name ||
      form.opencodeBaseUrl !== initial.opencodeBaseUrl ||
      (form.daemonBaseUrl ?? '') !== (initial.daemonBaseUrl ?? '') ||
      (form.noVncUrl ?? '') !== (initial.noVncUrl ?? '') ||
      (form.webTerminalUrl ?? '') !== (initial.webTerminalUrl ?? '')
    );
  }, [form, props.mode, props.initialData]);

  const handleSubmit = () => {
    const result = remoteConnectionInputSchema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? t('remote_dialog.invalid_settings'));
      return;
    }
    setError(null);
    props.onSubmit(result.data);
  };

  const setField = (key: keyof RemoteConnectionFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t('remote_dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="remote-name">{t('remote_dialog.profile_name')}</Label>
            <Input
              id="remote-name"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder={t('remote_dialog.placeholder_name')}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="remote-opencode">{t('remote_dialog.opencode_base_url')}</Label>
            <Input
              id="remote-opencode"
              value={form.opencodeBaseUrl}
              onChange={(event) =>
                setField('opencodeBaseUrl', event.target.value)
              }
              placeholder={t('remote_dialog.placeholder_opencode')}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="remote-daemon">{t('remote_dialog.daemon_base_url')}</Label>
            <Input
              id="remote-daemon"
              value={form.daemonBaseUrl ?? ''}
              onChange={(event) => setField('daemonBaseUrl', event.target.value)}
              placeholder={t('remote_dialog.placeholder_daemon')}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="remote-novnc">{t('remote_dialog.novnc_url')}</Label>
            <Input
              id="remote-novnc"
              value={form.noVncUrl ?? ''}
              onChange={(event) => setField('noVncUrl', event.target.value)}
              placeholder={t('remote_dialog.placeholder_novnc')}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="remote-web-terminal">
              {t('remote_dialog.web_terminal_url')}
            </Label>
            <Input
              id="remote-web-terminal"
              value={form.webTerminalUrl ?? ''}
              onChange={(event) =>
                setField('webTerminalUrl', event.target.value)
              }
              placeholder={t('remote_dialog.placeholder_terminal')}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={props.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || props.isPending}
          >
            {props.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
