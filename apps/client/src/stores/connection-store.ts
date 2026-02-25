/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  LOCAL_DAEMON_BASE_URL,
  LOCAL_NOVNC_URL,
  LOCAL_OPENCODE_BASE_URL,
  LOCAL_WEB_TERMINAL_URL,
} from '@/lib/constants';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionType = 'local' | 'remote';

export interface ConnectionProfile {
  id: string;
  name: string;
  type: ConnectionType;
  opencodeBaseUrl: string;
  daemonBaseUrl?: string;
  noVncUrl?: string;
  webTerminalUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConnectionSecrets {
  opencodeUsername?: string;
  opencodePassword?: string;
  daemonToken?: string;
}

interface ConnectionState {
  profiles: ConnectionProfile[];
  activeProfileId: string;
  /** Session-only secrets, never persisted. */
  secretsByProfile: Record<string, ConnectionSecrets>;
  /** Incremented whenever active profile changes. */
  switchNonce: number;
}

interface ConnectionActions {
  createRemoteProfile: (input: {
    name: string;
    opencodeBaseUrl: string;
    daemonBaseUrl?: string;
    noVncUrl?: string;
    webTerminalUrl?: string;
  }) => ConnectionProfile;
  updateProfile: (
    profileId: string,
    patch: Partial<
      Pick<
        ConnectionProfile,
        | 'name'
        | 'opencodeBaseUrl'
        | 'daemonBaseUrl'
        | 'noVncUrl'
        | 'webTerminalUrl'
      >
    >,
  ) => void;
  removeProfile: (profileId: string) => void;
  setActiveProfile: (profileId: string) => void;
  setSecrets: (profileId: string, secrets: ConnectionSecrets) => void;
  clearSecrets: (profileId: string) => void;
  clearAllSecrets: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LOCAL_CONNECTION_PROFILE_ID = 'local';
function getLocalConnectionProfileName(): string {
  return t('store.local_sandbox');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): number {
  return Date.now();
}

function createLocalProfile(existingCreatedAt?: number): ConnectionProfile {
  const timestamp = now();
  return {
    id: LOCAL_CONNECTION_PROFILE_ID,
    name: getLocalConnectionProfileName(),
    type: 'local',
    opencodeBaseUrl: LOCAL_OPENCODE_BASE_URL,
    daemonBaseUrl: LOCAL_DAEMON_BASE_URL,
    noVncUrl: LOCAL_NOVNC_URL,
    webTerminalUrl: LOCAL_WEB_TERMINAL_URL,
    createdAt: existingCreatedAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function createRemoteProfileId(): string {
  return `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureLocalProfile(
  profiles: ConnectionProfile[],
): ConnectionProfile[] {
  const local = profiles.find((profile) => profile.id === LOCAL_CONNECTION_PROFILE_ID);
  const rest = profiles.filter(
    (profile) => profile.id !== LOCAL_CONNECTION_PROFILE_ID,
  );
  return [createLocalProfile(local?.createdAt), ...rest];
}

function sanitizeProfiles(profiles: ConnectionProfile[]): ConnectionProfile[] {
  const dedup = new Map<string, ConnectionProfile>();
  for (const profile of profiles) {
    if (!profile.id) continue;
    dedup.set(profile.id, profile);
  }
  return ensureLocalProfile(Array.from(dedup.values()));
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type ConnectionStore = ConnectionState & ConnectionActions;

const initialState: ConnectionState = {
  profiles: [createLocalProfile()],
  activeProfileId: LOCAL_CONNECTION_PROFILE_ID,
  secretsByProfile: {},
  switchNonce: 0,
};

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set) => ({
      ...initialState,
      createRemoteProfile: (input) => {
        const timestamp = now();
        const profile: ConnectionProfile = {
          id: createRemoteProfileId(),
          name: input.name,
          type: 'remote',
          opencodeBaseUrl: input.opencodeBaseUrl,
          daemonBaseUrl: input.daemonBaseUrl,
          noVncUrl: input.noVncUrl,
          webTerminalUrl: input.webTerminalUrl,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set((state) => ({
          profiles: ensureLocalProfile([...state.profiles, profile]),
        }));

        return profile;
      },
      updateProfile: (profileId, patch) => {
        set((state) => ({
          profiles: state.profiles.map((profile) => {
            if (profile.id !== profileId) return profile;
            if (profile.type === 'local') {
              // Local profile is immutable to keep local defaults stable.
              return profile;
            }
            return {
              ...profile,
              ...patch,
              updatedAt: now(),
            };
          }),
        }));
      },
      removeProfile: (profileId) => {
        if (profileId === LOCAL_CONNECTION_PROFILE_ID) return;
        set((state) => {
          const nextProfiles = sanitizeProfiles(
            state.profiles.filter((profile) => profile.id !== profileId),
          );
          const nextActive = nextProfiles.some(
            (profile) => profile.id === state.activeProfileId,
          )
            ? state.activeProfileId
            : LOCAL_CONNECTION_PROFILE_ID;
          const { [profileId]: _removed, ...remainingSecrets } =
            state.secretsByProfile;
          return {
            profiles: nextProfiles,
            activeProfileId: nextActive,
            secretsByProfile: remainingSecrets,
            switchNonce:
              nextActive !== state.activeProfileId
                ? state.switchNonce + 1
                : state.switchNonce,
          };
        });
      },
      setActiveProfile: (profileId) => {
        set((state) => {
          if (!state.profiles.some((profile) => profile.id === profileId)) {
            return state;
          }
          if (state.activeProfileId === profileId) return state;
          return {
            activeProfileId: profileId,
            switchNonce: state.switchNonce + 1,
          };
        });
      },
      setSecrets: (profileId, secrets) => {
        set((state) => ({
          secretsByProfile: {
            ...state.secretsByProfile,
            [profileId]: {
              ...state.secretsByProfile[profileId],
              ...secrets,
            },
          },
        }));
      },
      clearSecrets: (profileId) => {
        set((state) => {
          const { [profileId]: _removed, ...remaining } = state.secretsByProfile;
          return { secretsByProfile: remaining };
        });
      },
      clearAllSecrets: () => {
        set({ secretsByProfile: {} });
      },
    }),
    {
      name: 'deck-connections',
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<ConnectionState>) ?? {};
        const profiles = sanitizeProfiles(persisted.profiles ?? []);
        const activeProfileId = profiles.some(
          (profile) => profile.id === persisted.activeProfileId,
        )
          ? (persisted.activeProfileId as string)
          : LOCAL_CONNECTION_PROFILE_ID;
        return {
          ...currentState,
          profiles,
          activeProfileId,
        };
      },
    },
  ),
);
