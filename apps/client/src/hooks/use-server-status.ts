/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useQuery } from '@tanstack/react-query';
import type {
  McpStatus,
  LspStatus,
  FormatterStatus,
} from '@opencode-ai/sdk/v2/client';

import { unwrap } from '@/lib/opencode';
import { useOpenCodeClient } from '@/hooks/use-opencode-client';
import { useConnectionScope } from '@/hooks/use-connection';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const STATUS_KEYS = {
  all: (scope: string) => ['server-status', scope] as const,
  mcp: (scope: string) => ['server-status', scope, 'mcp'] as const,
  lsp: (scope: string) => ['server-status', scope, 'lsp'] as const,
  formatter: (scope: string) => ['server-status', scope, 'formatter'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch MCP server statuses.
 * Returns a map of server name to McpStatus.
 */
export function useMcpStatus() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: STATUS_KEYS.mcp(scope),
    queryFn: async (): Promise<Record<string, McpStatus>> => {
      if (!client) return {};
      const result = await client.mcp.status();
      return unwrap(result) ?? {};
    },
    enabled: !!client,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

/**
 * Fetch LSP server statuses.
 * Returns an array of LspStatus entries.
 */
export function useLspStatus() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: STATUS_KEYS.lsp(scope),
    queryFn: async (): Promise<LspStatus[]> => {
      if (!client) return [];
      const result = await client.lsp.status();
      return unwrap(result) ?? [];
    },
    enabled: !!client,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

/**
 * Fetch formatter statuses.
 * Returns an array of FormatterStatus entries.
 */
export function useFormatterStatus() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: STATUS_KEYS.formatter(scope),
    queryFn: async (): Promise<FormatterStatus[]> => {
      if (!client) return [];
      const result = await client.formatter.status();
      return unwrap(result) ?? [];
    },
    enabled: !!client,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
