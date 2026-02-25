/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useQuery } from '@tanstack/react-query';
import type { FileNode, Path } from '@opencode-ai/sdk/v2/client';

import { unwrap } from '@/lib/opencode';
import { useOpenCodeClient } from '@/hooks/use-opencode-client';
import { useConnectionScope } from '@/hooks/use-connection';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const PROJECT_KEYS = {
  all: (scope: string) => ['project', scope] as const,
  paths: (scope: string) => ['project', scope, 'paths'] as const,
  findDirs: (scope: string, directory: string, query: string) =>
    ['project', scope, 'findDirs', directory, query] as const,
  listDirs: (scope: string, rootDirectory: string, directory: string) =>
    ['project', scope, 'listDirs', rootDirectory, directory] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectDirectoryItem {
  /** Directory name relative to the root home directory (trailing slash). */
  queryPath: string;
  /** Absolute path used when selecting/opening the project. */
  absolutePath: string;
  /** Directory display name (basename). */
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeQueryPath(value: string): string {
  const trimmed = value.trim().replace(/^\/+/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function toAbsolutePath(rootDirectory: string, queryPath: string): string {
  const relative = queryPath.replace(/\/+$/, '');
  if (!relative) return rootDirectory;
  return `${rootDirectory}/${relative}`;
}

function toRelativeQueryPath(
  rootDirectory: string,
  absolutePath: string,
): string {
  const normalizedRoot = rootDirectory.endsWith('/')
    ? rootDirectory.slice(0, -1)
    : rootDirectory;

  const relative = absolutePath.startsWith(`${normalizedRoot}/`)
    ? absolutePath.slice(normalizedRoot.length + 1)
    : absolutePath;

  return normalizeQueryPath(relative);
}

function toDirectoryName(queryPath: string, absolutePath: string): string {
  const normalized = queryPath.replace(/\/+$/, '');
  if (normalized.includes('/')) {
    const segments = normalized.split('/');
    return segments[segments.length - 1] ?? normalized;
  }
  if (normalized) return normalized;
  const absoluteSegments = absolutePath.split('/');
  return absoluteSegments[absoluteSegments.length - 1] ?? absolutePath;
}

function createDirectoryFromFind(
  rootDirectory: string,
  directoryPath: string,
): ProjectDirectoryItem | null {
  const queryPath = normalizeQueryPath(directoryPath);
  if (!queryPath) return null;

  const absolutePath = toAbsolutePath(rootDirectory, queryPath);
  return {
    queryPath,
    absolutePath,
    name: toDirectoryName(queryPath, absolutePath),
  };
}

function createDirectoryFromNode(
  rootDirectory: string,
  node: FileNode,
): ProjectDirectoryItem | null {
  if (node.type !== 'directory') return null;
  const queryPath = toRelativeQueryPath(rootDirectory, node.absolute);
  if (!queryPath) return null;

  return {
    queryPath,
    absolutePath: node.absolute,
    name: node.name,
  };
}

function dedupeDirectories(
  items: readonly ProjectDirectoryItem[],
): ProjectDirectoryItem[] {
  const byAbsolutePath = new Map<string, ProjectDirectoryItem>();
  for (const item of items) {
    byAbsolutePath.set(item.absolutePath, item);
  }
  return Array.from(byAbsolutePath.values());
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch system paths from the OpenCode server (home, state, config, etc.).
 */
export function usePaths() {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: PROJECT_KEYS.paths(scope),
    queryFn: async (): Promise<Path | null> => {
      if (!client) return null;
      const result = await client.path.get();
      return unwrap(result);
    },
    enabled: !!client,
    staleTime: 300_000, // paths rarely change
  });
}

/**
 * Search for directories under a given base path.
 * Used by the project picker to list available projects under /home/deck.
 */
export function useFindDirectories(baseDirectory: string, searchQuery: string) {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey: PROJECT_KEYS.findDirs(scope, baseDirectory, searchQuery),
    queryFn: async (): Promise<ProjectDirectoryItem[]> => {
      if (!client) return [];
      const result = await client.find.files({
        directory: baseDirectory,
        query: searchQuery,
        type: 'directory',
        limit: 50,
      });

      const data = unwrap(result);
      if (!Array.isArray(data)) return [];

      return dedupeDirectories(
        data
          .map((directoryPath) =>
            createDirectoryFromFind(baseDirectory, directoryPath),
          )
          .filter((item): item is ProjectDirectoryItem => item !== null),
      );
    },
    enabled: !!client,
    staleTime: 10_000,
  });
}

/**
 * List immediate child directories for a given absolute directory.
 * Uses GET /file?directory=<absolute>&path= to match OpenCode web behavior.
 */
export function useListChildDirectories(
  rootDirectory: string,
  directory: string | null,
) {
  const client = useOpenCodeClient();
  const scope = useConnectionScope();

  return useQuery({
    queryKey:
      directory === null
        ? [...PROJECT_KEYS.all(scope), 'listDirs', rootDirectory, 'none']
        : PROJECT_KEYS.listDirs(scope, rootDirectory, directory),
    queryFn: async (): Promise<ProjectDirectoryItem[]> => {
      if (!client || !directory) return [];

      const result = await client.file.list({
        directory,
        path: '',
      });
      const data = unwrap(result);
      if (!Array.isArray(data)) return [];

      return dedupeDirectories(
        data
          .map((node) => createDirectoryFromNode(rootDirectory, node))
          .filter((item): item is ProjectDirectoryItem => item !== null),
      );
    },
    enabled: !!client && !!directory,
    staleTime: 10_000,
  });
}
