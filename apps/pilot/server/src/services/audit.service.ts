/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { dirname, join } from 'node:path';
import { appendFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { AuditEntry } from '../types/index.js';
import { ensureDir, exists } from '../utils/fs.js';

export function auditLogPath(workspaceRoot: string): string {
  return join(workspaceRoot, '.opencode', 'pilot', 'audit.jsonl');
}

export function globalAuditLogPath(): string {
  return join(homedir(), '.config', 'pilot', 'audit.jsonl');
}

export async function recordAudit(
  workspaceRoot: string,
  entry: AuditEntry,
): Promise<void> {
  const path = auditLogPath(workspaceRoot);
  await ensureDir(dirname(path));
  await appendFile(path, JSON.stringify(entry) + '\n', 'utf8');
}

export async function recordGlobalAudit(entry: AuditEntry): Promise<void> {
  const path = globalAuditLogPath();
  await ensureDir(dirname(path));
  await appendFile(path, JSON.stringify(entry) + '\n', 'utf8');
}

export async function readLastAudit(
  workspaceRoot: string,
): Promise<AuditEntry | null> {
  const path = auditLogPath(workspaceRoot);
  if (!(await exists(path))) return null;
  const content = await readFile(path, 'utf8');
  const lines = content.trim().split('\n');
  const last = lines[lines.length - 1];
  if (!last) return null;
  try {
    return JSON.parse(last) as AuditEntry;
  } catch {
    return null;
  }
}

export async function readAuditEntries(
  workspaceRoot: string,
  limit = 50,
): Promise<AuditEntry[]> {
  const path = auditLogPath(workspaceRoot);
  if (!(await exists(path))) return [];
  const content = await readFile(path, 'utf8');
  const rawLines = content.trim().split('\n').filter(Boolean);
  if (!rawLines.length) return [];
  const slice = rawLines.slice(-Math.max(1, limit));
  const entries: AuditEntry[] = [];
  for (let i = slice.length - 1; i >= 0; i -= 1) {
    const line = slice[i];
    if (!line) continue;
    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch {
      // ignore malformed entry
    }
  }
  return entries;
}
