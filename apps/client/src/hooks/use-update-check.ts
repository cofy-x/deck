/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 *
 * TanStack Query hook that periodically checks GitHub Releases for a newer
 * version and surfaces a Sonner toast the first time a new version is detected.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { openUrl } from '@tauri-apps/plugin-opener';

import { t } from '@/i18n';
import { UPDATE_DISMISSED_KEY } from '@/lib/constants';
import { isTauriRuntime } from '@/lib/utils';
import {
  checkForUpdates,
  GITHUB_RELEASES_PAGE,
  type UpdateCheckResult,
} from '@/lib/update-check';

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

const UPDATE_CHECK_KEY = ['app', 'updateCheck'] as const;

// ---------------------------------------------------------------------------
// Dismiss helpers (localStorage)
// ---------------------------------------------------------------------------

function getDismissedVersion(): string | null {
  try {
    return window.localStorage.getItem(UPDATE_DISMISSED_KEY);
  } catch {
    return null;
  }
}

function setDismissedVersion(version: string) {
  try {
    window.localStorage.setItem(UPDATE_DISMISSED_KEY, version);
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export function useUpdateCheck() {
  const queryClient = useQueryClient();
  const toastShownForRef = useRef<string | null>(null);

  const query = useQuery<UpdateCheckResult>({
    queryKey: UPDATE_CHECK_KEY,
    queryFn: checkForUpdates,
    staleTime: ONE_HOUR,
    refetchInterval: FOUR_HOURS,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data } = query;

  const openReleasePage = useCallback((url?: string) => {
    const target = url || GITHUB_RELEASES_PAGE;
    if (isTauriRuntime()) {
      openUrl(target).catch(() => window.open(target, '_blank'));
    } else {
      window.open(target, '_blank');
    }
  }, []);

  useEffect(() => {
    if (!data?.hasUpdate || !data.latestRelease) return;

    const latestVer = data.latestRelease.version;

    if (getDismissedVersion() === latestVer) return;
    if (toastShownForRef.current === latestVer) return;

    toastShownForRef.current = latestVer;

    const description = t('update.available_description').replace(
      '{version}',
      latestVer,
    );

    toast(t('update.available_title'), {
      description,
      duration: 15_000,
      action: {
        label: t('update.download'),
        onClick: () => openReleasePage(data.latestRelease!.htmlUrl),
      },
      cancel: {
        label: t('update.dismiss'),
        onClick: () => setDismissedVersion(latestVer),
      },
    });
  }, [data, openReleasePage]);

  const refetch = useCallback(() => queryClient.invalidateQueries({ queryKey: UPDATE_CHECK_KEY }), [queryClient]);

  return {
    currentVersion: data?.currentVersion ?? null,
    latestVersion: data?.latestRelease?.version ?? null,
    releaseUrl: data?.latestRelease?.htmlUrl ?? null,
    hasUpdate: data?.hasUpdate ?? false,
    isChecking: query.isFetching,
    refetch,
    openReleasePage,
  };
}
