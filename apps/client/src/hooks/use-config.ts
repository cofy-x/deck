/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Agent,
  Auth,
  Config,
  Provider,
  ProviderAuthMethod,
  ProviderConfig,
  Model,
  ProviderListResponse,
} from '@opencode-ai/sdk/v2/client';
import { toast } from 'sonner';

import { unwrap } from '@/lib/opencode';
import {
  saveCredential,
  removeCredential,
  saveCustomProvider,
} from '@/lib/credential-store';
import { useOpenCodeClient } from '@/hooks/use-opencode-client';
import { useActiveConnection, useConnectionScope } from '@/hooks/use-connection';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const CONFIG_KEYS = {
  all: (scope: string) => ['config', scope] as const,
  config: (scope: string) => ['config', scope, 'detail'] as const,
  providers: (scope: string) => ['config', scope, 'providers'] as const,
  agents: (scope: string) => ['config', scope, 'agents'] as const,
  providerAuth: (scope: string) =>
    ['config', scope, 'provider-auth'] as const,
};

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

/** A model entry enriched with its parent provider information. */
export interface FlatModel {
  /** Composite key: "providerID/modelID" */
  key: string;
  providerID: string;
  providerName: string;
  providerConnected: boolean;
  model: Model;
}

/** Shape returned by `useProviders`. */
export interface ProvidersData {
  /** All provider entries from the server. */
  providers: Provider[];
  /** Map of default model IDs per provider. */
  defaults: Record<string, string>;
  /** Set of connected provider IDs. */
  connected: Set<string>;
  /** Flat list of all models across all providers. */
  models: FlatModel[];
}

// ---------------------------------------------------------------------------
// Provider list item type from the ProviderListResponse
// (The server returns a slightly different shape than the Provider type.)
// ---------------------------------------------------------------------------

type ProviderListItem = ProviderListResponse extends {
  all: Array<infer T>;
}
  ? T
  : never;

type ProviderListModelEntry = ProviderListItem extends {
  models: { [key: string]: infer M };
}
  ? M
  : never;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the current OpenCode configuration.
 */
export function useConfig() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: CONFIG_KEYS.config(scope),
    queryFn: async (): Promise<Config | null> => {
      if (!client) return null;
      const result = await client.config.get();
      return unwrap(result);
    },
    enabled: !!client,
    staleTime: 30_000,
  });
}

/**
 * Update the OpenCode configuration.
 * Invalidates **all** config-related queries on success so downstream
 * consumers (ModelSelector, ProviderList, etc.) re-render with fresh data.
 */
export function useUpdateConfig() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();

  return useMutation({
    mutationFn: async (patch: Partial<Config>): Promise<Config> => {
      if (!client) throw new Error('No client available');
      const result = await client.config.update({ config: patch as Config });
      return unwrap(result);
    },
    onSuccess: () => {
      // Invalidate all config queries so providers/models also refresh
      void qc.invalidateQueries({ queryKey: CONFIG_KEYS.all(scope) });
      toast.success('Configuration updated');
    },
    onError: (error) => {
      console.error('[useUpdateConfig] Failed to update config:', error);
      toast.error('Failed to update configuration');
    },
  });
}

/**
 * Fetch all providers, their connection status, and flatten models into
 * a single list for easy consumption by the model selector.
 */
export function useProviders() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  const query = useQuery({
    queryKey: CONFIG_KEYS.providers(scope),
    queryFn: async (): Promise<ProvidersData | null> => {
      if (!client) return null;
      const result = await client.provider.list();
      const data = unwrap(result) as ProviderListResponse;

      const connected = new Set<string>(data.connected);
      const defaults: Record<string, string> = data.default;

      // Map the provider list items to the standard Provider shape
      const providers: Provider[] = data.all.map((p: ProviderListItem) => {
        const models: Record<string, Model> = {};
        for (const [modelKey, modelEntry] of Object.entries(p.models)) {
          models[modelKey] = mapToModel(p.id, modelEntry);
        }
        return {
          id: p.id,
          name: p.name,
          source: 'config' as const,
          env: p.env,
          options: {},
          models,
        };
      });

      // Build flat model list
      const models: FlatModel[] = [];
      for (const provider of providers) {
        for (const [, model] of Object.entries(provider.models)) {
          models.push({
            key: `${provider.id}/${model.id}`,
            providerID: provider.id,
            providerName: provider.name,
            providerConnected: connected.has(provider.id),
            model,
          });
        }
      }

      return { providers, defaults, connected, models };
    },
    enabled: !!client,
    staleTime: 60_000,
  });

  // Memoize the active model key derived from config
  const activeModels = useMemo(() => {
    if (!query.data)
      return { models: [] as FlatModel[], providers: [] as Provider[] };
    return {
      models: query.data.models,
      providers: query.data.providers,
    };
  }, [query.data]);

  return { ...query, ...activeModels };
}

// ---------------------------------------------------------------------------
// Agent hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all agents, filtering to those visible in the mode selector:
 * `mode === "primary" && hidden !== true`, sorted with `native === false` first.
 */
export function useAgents() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: CONFIG_KEYS.agents(scope),
    queryFn: async (): Promise<Agent[]> => {
      if (!client) return [];
      const result = await client.app.agents();
      const agents = unwrap(result) ?? [];
      return agents
        .filter((a: Agent) => a.mode === 'primary' && a.hidden !== true)
        .sort((a: Agent, b: Agent) => {
          // non-native first
          if (a.native !== b.native) return a.native ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
    },
    enabled: !!client,
    staleTime: 120_000,
  });
}

// ---------------------------------------------------------------------------
// Provider authentication hooks
// ---------------------------------------------------------------------------

/**
 * Fetch auth methods for all providers.
 * Returns `{ [providerID]: ProviderAuthMethod[] }`.
 */
export function useProviderAuthMethods() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: CONFIG_KEYS.providerAuth(scope),
    queryFn: async (): Promise<Record<string, ProviderAuthMethod[]>> => {
      if (!client) return {};
      const result = await client.provider.auth();
      return unwrap(result) ?? {};
    },
    enabled: !!client,
    staleTime: 120_000,
  });
}

/**
 * Set authentication credentials for a provider (e.g. API key).
 *
 * The mutation follows the same flow as the official OpenCode web UI:
 *   1. POST /auth/{providerID}  — store the credential
 *   2. POST /global/dispose     — reinitialise the server so it picks up the new auth
 *   3. Refetch provider list    — UI reflects the new connected state
 */
export function useSetAuth() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();
  const { profile } = useActiveConnection();

  return useMutation({
    mutationFn: async (input: {
      providerID: string;
      providerName?: string;
      auth: Auth;
    }) => {
      if (!client) throw new Error('No client available');
      // 1. Store credential on the server
      const result = await client.auth.set({
        providerID: input.providerID,
        auth: input.auth,
      });
      unwrap(result);
      // 2. Dispose so the server reinitialises with the new credential
      await client.global.dispose();
      return input;
    },
    onSuccess: (_data, variables) => {
      const label = variables.providerName ?? variables.providerID;
      // 3. Refetch everything
      void qc.invalidateQueries({ queryKey: CONFIG_KEYS.all(scope) });
      toast.success(`${label} connected`, {
        description: `You can now use ${label} models.`,
      });
      // 4. Persist credential to local SQLite for sandbox restart recovery
      void saveCredential(
        profile.id,
        variables.providerID,
        variables.auth.type,
        JSON.stringify(variables.auth),
      ).catch((err) =>
        console.error('[useSetAuth] Failed to persist credential locally:', err),
      );
    },
    onError: (error) => {
      console.error('[useSetAuth] Failed to set auth:', error);
      toast.error('Failed to connect provider');
    },
  });
}

/**
 * Remove authentication credentials for a provider.
 *
 * Same dispose flow as connect: remove → dispose → refetch.
 */
export function useRemoveAuth() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();
  const { profile } = useActiveConnection();

  return useMutation({
    mutationFn: async (input: {
      providerID: string;
      providerName?: string;
    }) => {
      if (!client) throw new Error('No client available');
      // 1. Remove credential
      const result = await client.auth.remove({ providerID: input.providerID });
      unwrap(result);
      // 2. Dispose so the server reinitialises
      await client.global.dispose();
      return input;
    },
    onSuccess: (_data, variables) => {
      const label = variables.providerName ?? variables.providerID;
      // 3. Refetch everything
      void qc.invalidateQueries({ queryKey: CONFIG_KEYS.all(scope) });
      toast.success(`${label} disconnected`, {
        description: `${label} models are no longer available.`,
      });
      // 4. Remove credential from local SQLite
      void removeCredential(profile.id, variables.providerID).catch((err) =>
        console.error(
          '[useRemoveAuth] Failed to remove credential locally:',
          err,
        ),
      );
    },
    onError: (error) => {
      console.error('[useRemoveAuth] Failed to remove auth:', error);
      toast.error('Failed to disconnect provider');
    },
  });
}

// ---------------------------------------------------------------------------
// Custom provider hooks
// ---------------------------------------------------------------------------

/** Input shape for adding a custom OpenAI-compatible provider. */
export interface CustomProviderInput {
  id: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  models: Array<{ id: string; name: string }>;
  headers?: Record<string, string>;
}

/**
 * Add a custom OpenAI-compatible provider to the OpenCode configuration
 * and optionally store an API key credential for it.
 */
export function useAddCustomProvider() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();
  const { profile } = useActiveConnection();

  return useMutation({
    mutationFn: async (input: CustomProviderInput) => {
      if (!client) throw new Error('No client available');

      // Build model map
      const models: Record<string, { name: string }> = {};
      for (const m of input.models) {
        if (m.id.trim()) {
          models[m.id.trim()] = { name: m.name.trim() || m.id.trim() };
        }
      }

      // Build provider config patch
      const providerPatch: ProviderConfig = {
        npm: '@ai-sdk/openai-compatible',
        name: input.name.trim(),
        models,
      };

      // Build options object
      const options: Record<string, unknown> = {
        baseURL: input.baseURL.trim(),
      };
      if (input.headers && Object.keys(input.headers).length > 0) {
        options['headers'] = input.headers;
      }
      providerPatch.options = options as ProviderConfig['options'];

      // Update global config so the provider survives dispose() reinitialisation
      const result = await client.global.config.update({
        config: {
          provider: { [input.id.trim()]: providerPatch },
        } as Config,
      });
      const config = unwrap(result);

      // If an API key was provided, store it as a credential
      if (input.apiKey?.trim()) {
        await client.auth.set({
          providerID: input.id.trim(),
          auth: { type: 'api', key: input.apiKey.trim() },
        });
      }

      // Dispose so the server picks up the new provider + credential
      await client.global.dispose();

      // Persist custom provider config + credential locally for restart recovery
      const providerConfigJson = JSON.stringify(providerPatch);
      void saveCustomProvider(
        profile.id,
        input.id.trim(),
        input.name.trim(),
        providerConfigJson,
      ).catch((err) =>
        console.error(
          '[useAddCustomProvider] Failed to persist custom provider locally:',
          err,
        ),
      );
      if (input.apiKey?.trim()) {
        const auth = { type: 'api' as const, key: input.apiKey.trim() };
        void saveCredential(
          profile.id,
          input.id.trim(),
          'api',
          JSON.stringify(auth),
        ).catch((err) =>
          console.error(
            '[useAddCustomProvider] Failed to persist credential locally:',
            err,
          ),
        );
      }

      return config;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONFIG_KEYS.all(scope) });
      toast.success('Custom provider added');
    },
    onError: (error) => {
      console.error('[useAddCustomProvider] Failed:', error);
      toast.error('Failed to add custom provider');
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map the provider-list model entry (inline shape) to the canonical Model type.
 */
function mapToModel(providerID: string, entry: ProviderListModelEntry): Model {
  return {
    id: entry.id,
    providerID,
    api: { id: '', url: '', npm: '' },
    name: entry.name,
    family: entry.family,
    capabilities: {
      temperature: entry.temperature,
      reasoning: entry.reasoning,
      attachment: entry.attachment,
      toolcall: entry.tool_call,
      input: {
        text: entry.modalities?.input.includes('text') ?? true,
        audio: entry.modalities?.input.includes('audio') ?? false,
        image: entry.modalities?.input.includes('image') ?? false,
        video: entry.modalities?.input.includes('video') ?? false,
        pdf: entry.modalities?.input.includes('pdf') ?? false,
      },
      output: {
        text: entry.modalities?.output.includes('text') ?? true,
        audio: entry.modalities?.output.includes('audio') ?? false,
        image: entry.modalities?.output.includes('image') ?? false,
        video: entry.modalities?.output.includes('video') ?? false,
        pdf: entry.modalities?.output.includes('pdf') ?? false,
      },
      interleaved: entry.interleaved ?? false,
    },
    cost: {
      input: entry.cost?.input ?? 0,
      output: entry.cost?.output ?? 0,
      cache: {
        read: entry.cost?.cache_read ?? 0,
        write: entry.cost?.cache_write ?? 0,
      },
    },
    limit: {
      context: entry.limit.context,
      input: entry.limit.input,
      output: entry.limit.output,
    },
    status: entry.status ?? 'active',
    options: entry.options,
    headers: entry.headers ?? {},
    release_date: entry.release_date,
    variants: entry.variants,
  };
}
