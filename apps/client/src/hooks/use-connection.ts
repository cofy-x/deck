/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useMemo } from 'react';

import {
  LOCAL_CONNECTION_PROFILE_ID,
  useConnectionStore,
  type ConnectionProfile,
  type ConnectionSecrets,
} from '@/stores/connection-store';
import {
  resolveConnectionEndpoints,
  type ResolvedConnectionEndpoints,
} from '@/lib/connection-endpoints';

export interface ActiveConnection {
  profile: ConnectionProfile;
  endpoints: ResolvedConnectionEndpoints;
  secrets: ConnectionSecrets;
  isRemote: boolean;
  isLocal: boolean;
  scope: string;
}

function getActiveProfile(
  profiles: ConnectionProfile[],
  activeProfileId: string,
): ConnectionProfile | null {
  if (profiles.length === 0) return null;
  return (
    profiles.find((profile) => profile.id === activeProfileId) ??
    profiles.find((profile) => profile.id === LOCAL_CONNECTION_PROFILE_ID) ??
    profiles[0]
  );
}

export function useActiveConnection(): ActiveConnection {
  const profiles = useConnectionStore((s) => s.profiles);
  const activeProfileId = useConnectionStore((s) => s.activeProfileId);
  const secretsByProfile = useConnectionStore((s) => s.secretsByProfile);

  return useMemo(() => {
    const profile = getActiveProfile(profiles, activeProfileId);
    if (!profile) {
      throw new Error('No connection profile available');
    }
    const endpoints = resolveConnectionEndpoints(profile);
    const secrets = secretsByProfile[profile.id] ?? {};
    return {
      profile,
      endpoints,
      secrets,
      isRemote: profile.type === 'remote',
      isLocal: profile.type === 'local',
      scope: `${profile.id}|${endpoints.opencodeBaseUrl}`,
    };
  }, [profiles, activeProfileId, secretsByProfile]);
}

export function useConnectionScope(): string {
  return useActiveConnection().scope;
}
