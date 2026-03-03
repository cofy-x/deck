/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useQuery } from '@tanstack/react-query';
import type { Agent } from '@opencode-ai/sdk/v2/client';
import { unwrap } from '@/lib/opencode';
import { useOpenCodeClient } from '@/hooks/use-opencode-client';
import { useConnectionScope } from '@/hooks/use-connection';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const MENTION_KEYS = {
  agents: (scope: string) => ['mention', scope, 'agents'] as const,
  files: (scope: string, query: string, directory?: string | null) =>
    ['mention', scope, 'files', directory ?? '', query] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentInfo = Pick<
  Agent,
  'name' | 'description' | 'mode' | 'hidden' | 'color'
>;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch subagents available for @ mention.
 * Filters for agents with mode === 'subagent' or mode === 'all', and not hidden.
 */
export function useSubagents(options?: { enabled?: boolean }) {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();
  const isEnabled = options?.enabled ?? true;

  return useQuery({
    queryKey: MENTION_KEYS.agents(scope),
    queryFn: async (): Promise<AgentInfo[]> => {
      if (!client) return [];
      const result = await client.app.agents();
      const agents = unwrap(result);

      if (!Array.isArray(agents)) return [];

      return agents.filter(
        (a) => !a.hidden && (a.mode === 'subagent' || a.mode === 'all'),
      );
    },
    enabled: !!client && isEnabled,
    staleTime: 60_000,
  });
}

/**
 * Search for files matching a query string (used for @ file mentions).
 * Calls GET /find/file?query=...&dirs=true
 * Accepts an optional directory scope for the search.
 */
export function useFindFiles(
  query: string,
  directory?: string | null,
  options?: { enabled?: boolean },
) {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();
  const isEnabled = options?.enabled ?? true;

  return useQuery({
    queryKey: MENTION_KEYS.files(scope, query, directory),
    queryFn: async (): Promise<string[]> => {
      if (!client || !query) return [];
      const result = await client.find.files({
        query,
        limit: 20,
        ...(directory ? { directory } : {}),
      });
      const data = unwrap(result);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!client && query.length > 0 && isEnabled,
    staleTime: 5_000,
  });
}
