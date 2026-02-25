/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Command } from '@opencode-ai/sdk/v2/client';
import { unwrap } from '@/lib/opencode';
import { useOpenCodeClient } from '@/hooks/use-opencode-client';
import { useConnectionScope } from '@/hooks/use-connection';
import { SESSION_KEYS } from '@/hooks/use-session';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const COMMAND_KEYS = {
  list: (scope: string) => ['commands', scope, 'list'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientCommand {
  name: string;
  description: string;
  shortcut?: string;
}

// ---------------------------------------------------------------------------
// Client-side commands (executed in the frontend, not sent to opencode)
// ---------------------------------------------------------------------------

export function getClientCommands(): ClientCommand[] {
  return [
    { name: 'new', description: t('command.new') },
    { name: 'desktop', description: t('command.desktop') },
    { name: 'open', description: t('command.open') },
    { name: 'terminal', description: t('command.terminal') },
    { name: 'model', description: t('command.model') },
    { name: 'mcp', description: t('command.mcp') },
    { name: 'agent', description: t('command.agent') },
    { name: 'opencode', description: t('command.opencode') },
  ];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch server-side commands from the OpenCode command API.
 * Returns Command[] from the SDK (name, description?, agent?, etc.)
 */
export function useServerCommands() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: COMMAND_KEYS.list(scope),
    queryFn: async (): Promise<Command[]> => {
      if (!client) return [];
      const result = await client.command.list();
      const data = unwrap(result);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!client,
    staleTime: 60_000,
  });
}

/**
 * Execute a server-side command on a session.
 */
export function useExecuteCommand() {
  const client = useOpenCodeClient();
  const qc = useQueryClient();
  const scope = useConnectionScope();

  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      command: string;
      arguments: string;
    }) => {
      if (!client) throw new Error('No client available');
      const result = await client.session.command({
        sessionID: input.sessionId,
        command: input.command,
        arguments: input.arguments,
      });
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: SESSION_KEYS.messages(scope, variables.sessionId),
      });
    },
    onError: (error) => {
      console.error('[useExecuteCommand] Failed:', error);
    },
  });
}
