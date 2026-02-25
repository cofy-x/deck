/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOpenCodeClient } from '@/hooks/use-opencode-client';
import { useConnectionScope } from '@/hooks/use-connection';
import { unwrap } from '@/lib/opencode';
import { STATUS_KEYS } from '@/hooks/use-server-status';

/**
 * Connect or disconnect an MCP server by name.
 */
export function useMcpToggle() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();

  return useMutation({
    mutationFn: async (input: { name: string; connect: boolean }) => {
      if (!client) throw new Error('No client available');
      if (input.connect) {
        const result = await client.mcp.connect({ name: input.name });
        return unwrap(result);
      } else {
        const result = await client.mcp.disconnect({ name: input.name });
        return unwrap(result);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: STATUS_KEYS.mcp(scope) });
    },
    onError: (error) => {
      console.error('[useMcpToggle] Failed:', error);
    },
  });
}
