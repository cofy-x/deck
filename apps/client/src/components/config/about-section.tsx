/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { RefreshCw, ExternalLink } from 'lucide-react';

import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useUpdateCheck } from '@/hooks/use-update-check';

export function AboutSection() {
  const {
    currentVersion,
    latestVersion,
    hasUpdate,
    isChecking,
    refetch,
    openReleasePage,
    releaseUrl,
  } = useUpdateCheck();

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{t('config.about')}</h3>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label className="text-sm">{t('update.current_version')}</Label>
          <span className="text-xs text-muted-foreground">
            v{currentVersion ?? '...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasUpdate && latestVersion && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => openReleasePage(releaseUrl ?? undefined)}
            >
              <ExternalLink className="h-3 w-3" />
              {t('update.new_version_badge').replace(
                '{version}',
                latestVersion,
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={isChecking}
            onClick={() => refetch()}
          >
            <RefreshCw
              className={cn('h-3 w-3', isChecking && 'animate-spin')}
            />
            {isChecking ? t('update.checking') : t('update.check')}
          </Button>
        </div>
      </div>
      {!hasUpdate && currentVersion && !isChecking && (
        <p className="text-xs text-muted-foreground">
          {t('update.up_to_date')}
        </p>
      )}
    </div>
  );
}
