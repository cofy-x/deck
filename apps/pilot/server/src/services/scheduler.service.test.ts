/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  deleteResolvedScheduledJob,
  listScheduledJobs,
  resolveScheduledJobBySlug,
} from './scheduler.service.js';

const HOME_ENV_KEYS = ['HOME', 'USERPROFILE'] as const;
const HOME_ENV_SNAPSHOT = new Map<string, string | undefined>(
  HOME_ENV_KEYS.map((key) => [key, process.env[key]]),
);
const createdHomes: string[] = [];

function restoreHomeEnv(): void {
  for (const key of HOME_ENV_KEYS) {
    const value = HOME_ENV_SNAPSHOT.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function createJobFixture(
  slug: string,
): Promise<{ home: string; jobsDir: string }> {
  const home = await mkdtemp(join(tmpdir(), 'pilot-server-scheduler-test-'));
  createdHomes.push(home);
  process.env['HOME'] = home;
  process.env['USERPROFILE'] = home;
  const jobsDir = join(home, '.config', 'opencode', 'jobs');
  await mkdir(jobsDir, { recursive: true });
  await writeFile(
    join(jobsDir, `${slug}.json`),
    JSON.stringify(
      {
        slug,
        name: 'Nightly Build',
        schedule: '0 3 * * *',
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );
  return { home, jobsDir };
}

afterEach(async () => {
  restoreHomeEnv();
  await Promise.all(
    createdHomes.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
});

describe('scheduler service', () => {
  test('resolves jobs by exact slug only', async () => {
    await createJobFixture('nightly-build');

    const jobs = await listScheduledJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.slug).toBe('nightly-build');

    await expect(resolveScheduledJobBySlug('nightly')).rejects.toMatchObject({
      status: 404,
      code: 'job_not_found',
    });

    const resolved = await resolveScheduledJobBySlug('nightly-build');
    expect(resolved.job.slug).toBe('nightly-build');
  });

  test('rejects invalid job slug path traversal', async () => {
    await createJobFixture('daily-sync');

    await expect(resolveScheduledJobBySlug('../daily-sync')).rejects.toMatchObject({
      status: 400,
      code: 'invalid_job_slug',
    });
  });

  test('deletes previously resolved job without re-resolving by slug', async () => {
    await createJobFixture('cleanup-job');
    const resolved = await resolveScheduledJobBySlug('cleanup-job');

    await deleteResolvedScheduledJob(resolved);

    await expect(resolveScheduledJobBySlug('cleanup-job')).rejects.toMatchObject({
      status: 404,
      code: 'job_not_found',
    });
  });
});
