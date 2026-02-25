/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ScheduledJob } from '../types/index.js';
import { ApiError } from '../errors.js';
import { exists, readJsonFile } from '../utils/fs.js';

const SUPPORTED_PLATFORMS = new Set(['darwin', 'linux']);
const DEFAULT_COMMAND_TIMEOUT_MS = 5000;

interface SchedulerCommandInput {
  command: string;
  args: string[];
  timeoutMs?: number;
}

interface SchedulerCommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

interface SchedulerCommandAssertionInput extends SchedulerCommandInput {
  result: SchedulerCommandResult;
  allowExitCodes?: number[];
}

export interface ResolvedScheduledJob {
  job: ScheduledJob;
  jobFile: string;
  systemPaths: string[];
}

function ensureSchedulerSupported(): void {
  if (SUPPORTED_PLATFORMS.has(process.platform)) return;
  throw new ApiError(
    400,
    'scheduler_unsupported',
    'Scheduler is supported only on macOS and Linux.',
  );
}

function resolveHomeDir(): string {
  const home = homedir();
  if (!home) {
    throw new ApiError(
      500,
      'home_dir_missing',
      'Failed to resolve home directory',
    );
  }
  return home;
}

function opencodeJobsDir(): string {
  return join(resolveHomeDir(), '.config', 'opencode', 'jobs');
}

function normalizeJobSlug(raw: string): string {
  const slug = raw.trim();
  if (!slug) {
    throw new ApiError(400, 'job_slug_required', 'Job slug is required');
  }
  if (
    slug.includes('/') ||
    slug.includes('\\') ||
    slug.includes('..') ||
    slug.includes('\0')
  ) {
    throw new ApiError(400, 'invalid_job_slug', 'Invalid job slug');
  }
  return slug;
}

function jobFilePath(jobsDir: string, slug: string): string {
  return join(jobsDir, `${slug}.json`);
}

async function loadJobFile(path: string): Promise<ScheduledJob | null> {
  const job = await readJsonFile<Partial<ScheduledJob>>(path);
  if (!job || typeof job !== 'object') return null;
  if (
    typeof job.slug !== 'string' ||
    typeof job.name !== 'string' ||
    typeof job.schedule !== 'string'
  ) {
    return null;
  }
  return job as ScheduledJob;
}

async function loadJobBySlug(
  jobsDir: string,
  slug: string,
): Promise<ScheduledJob | null> {
  const normalized = normalizeJobSlug(slug);
  const path = jobFilePath(jobsDir, normalized);
  if (!(await exists(path))) return null;
  return loadJobFile(path);
}

async function loadAllJobs(jobsDir: string): Promise<ScheduledJob[]> {
  if (!(await exists(jobsDir))) return [];
  const entries = await readdir(jobsDir, { withFileTypes: true });
  const jobs: ScheduledJob[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.json')) continue;
    const path = join(jobsDir, entry.name);
    const job = await loadJobFile(path);
    if (job) jobs.push(job);
  }
  jobs.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return jobs;
}

function schedulerSystemPaths(slug: string): string[] {
  if (process.platform === 'darwin') {
    return [
      join(
        resolveHomeDir(),
        'Library',
        'LaunchAgents',
        `com.opencode.job.${slug}.plist`,
      ),
    ];
  }
  if (process.platform === 'linux') {
    const base = join(resolveHomeDir(), '.config', 'systemd', 'user');
    return [
      join(base, `opencode-job-${slug}.service`),
      join(base, `opencode-job-${slug}.timer`),
    ];
  }
  return [];
}

async function runSchedulerCommand(
  input: SchedulerCommandInput,
): Promise<SchedulerCommandResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, { stdio: 'pipe' });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }, 300);
    }, timeoutMs);

    const finish = (result: SchedulerCommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      finish({
        code,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString('utf8').trim(),
        stderr: Buffer.concat(stderrChunks).toString('utf8').trim(),
        timedOut,
      });
    });
  });
}

function assertSchedulerCommandResult(
  input: SchedulerCommandAssertionInput,
): void {
  const allowed = input.allowExitCodes ?? [0];
  if (input.result.code != null && allowed.includes(input.result.code)) {
    return;
  }
  throw new ApiError(
    502,
    'scheduler_command_failed',
    'Scheduler system command failed',
    {
      command: input.command,
      args: input.args,
      code: input.result.code,
      signal: input.result.signal,
      timedOut: input.result.timedOut,
      stdout: input.result.stdout || null,
      stderr: input.result.stderr || null,
    },
  );
}

async function uninstallJob(slug: string): Promise<void> {
  if (process.platform === 'darwin') {
    const [plist] = schedulerSystemPaths(slug);
    if (plist && (await exists(plist))) {
      const result = await runSchedulerCommand({
        command: 'launchctl',
        args: ['unload', plist],
      });
      assertSchedulerCommandResult({
        command: 'launchctl',
        args: ['unload', plist],
        result,
      });
      await rm(plist, { force: true });
    }
    return;
  }

  if (process.platform === 'linux') {
    const [service, timer] = schedulerSystemPaths(slug);
    const timerUnit = `opencode-job-${slug}.timer`;
    const timerExists = Boolean(timer && (await exists(timer)));

    if (timerExists) {
      const stopResult = await runSchedulerCommand({
        command: 'systemctl',
        args: ['--user', 'stop', timerUnit],
      });
      assertSchedulerCommandResult({
        command: 'systemctl',
        args: ['--user', 'stop', timerUnit],
        result: stopResult,
        allowExitCodes: [0, 5],
      });
      const disableResult = await runSchedulerCommand({
        command: 'systemctl',
        args: ['--user', 'disable', timerUnit],
      });
      assertSchedulerCommandResult({
        command: 'systemctl',
        args: ['--user', 'disable', timerUnit],
        result: disableResult,
        allowExitCodes: [0, 1, 5],
      });
    }

    let removedSystemFiles = false;
    if (service && (await exists(service))) {
      await rm(service, { force: true });
      removedSystemFiles = true;
    }
    if (timer && (await exists(timer))) {
      await rm(timer, { force: true });
      removedSystemFiles = true;
    }

    if (removedSystemFiles) {
      const reloadResult = await runSchedulerCommand({
        command: 'systemctl',
        args: ['--user', 'daemon-reload'],
      });
      assertSchedulerCommandResult({
        command: 'systemctl',
        args: ['--user', 'daemon-reload'],
        result: reloadResult,
      });
    }
    return;
  }

  ensureSchedulerSupported();
}

export async function listScheduledJobs(): Promise<ScheduledJob[]> {
  ensureSchedulerSupported();
  const jobsDir = opencodeJobsDir();
  return loadAllJobs(jobsDir);
}

export async function resolveScheduledJobBySlug(
  slug: string,
): Promise<ResolvedScheduledJob> {
  ensureSchedulerSupported();
  const normalized = normalizeJobSlug(slug);
  const jobsDir = opencodeJobsDir();
  const job = await loadJobBySlug(jobsDir, normalized);
  if (!job) {
    throw new ApiError(404, 'job_not_found', `Job "${normalized}" not found.`);
  }
  return {
    job,
    jobFile: jobFilePath(jobsDir, job.slug),
    systemPaths: schedulerSystemPaths(job.slug),
  };
}

export async function deleteResolvedScheduledJob(
  resolved: ResolvedScheduledJob,
): Promise<void> {
  await uninstallJob(resolved.job.slug);
  await rm(resolved.jobFile, { force: true });
}
