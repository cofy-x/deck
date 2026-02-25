/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolve } from 'node:path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ResolveBinaryOptions, ResolvedBinary } from '../types/index.js';
import { fileExists, isExecutable } from '../utils/fs.js';
import { resolveBinPath } from '../utils/process.js';
import { downloadSidecarBinary, resolveOpencodeDownload } from './download.js';
import { resolveBundledBinary, resolveExpectedVersion } from './version.js';

type WorkspaceBinName = 'pilot-server' | 'pilot-bridge';

async function resolveWorkspaceBin(name: WorkspaceBinName): Promise<string | null> {
  const startDirs = [
    resolve(fileURLToPath(new URL('.', import.meta.url))),
    process.cwd(),
  ];
  const candidates = new Set<string>();
  for (const startDir of startDirs) {
    let current = startDir;
    for (let depth = 0; depth < 8; depth += 1) {
      candidates.add(join(current, 'node_modules', '.bin', name));
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function resolvePilotServerBin(
  options: ResolveBinaryOptions,
): Promise<ResolvedBinary> {
  if (options.explicit && !options.allowExternal) {
    throw new Error('pilot-server-bin requires --allow-external');
  }
  if (
    options.explicit &&
    options.source !== 'auto' &&
    options.source !== 'external'
  ) {
    throw new Error(
      'pilot-server-bin requires --sidecar-source external or auto',
    );
  }

  const expectedVersion = await resolveExpectedVersion(
    options.manifest,
    'pilot-server',
  );
  const resolveExternal = async (): Promise<ResolvedBinary> => {
    if (!options.allowExternal) {
      throw new Error('External pilot-server requires --allow-external');
    }
    if (options.explicit) {
      const resolved = resolveBinPath(options.explicit);
      if (
        (resolved.includes('/') || resolved.startsWith('.')) &&
        !(await fileExists(resolved))
      ) {
        throw new Error(`pilot-server-bin not found: ${resolved}`);
      }
      return { bin: resolved, source: 'external', expectedVersion };
    }
    return { bin: 'pilot-server', source: 'external', expectedVersion };
  };

  if (options.source === 'bundled') {
    const bundled = await resolveBundledBinary(
      options.manifest,
      'pilot-server',
    );
    if (!bundled) {
      throw new Error('Bundled pilot-server binary missing.');
    }
    return { bin: bundled, source: 'bundled', expectedVersion };
  }

  if (options.source === 'downloaded') {
    const downloaded = await downloadSidecarBinary({
      name: 'pilot-server',
      sidecar: options.sidecar,
    });
    if (!downloaded) {
      throw new Error('pilot-server download failed.');
    }
    return downloaded;
  }

  if (options.source === 'external') {
    return resolveExternal();
  }

  const workspaceBin = await resolveWorkspaceBin('pilot-server');
  if (workspaceBin) {
    return { bin: workspaceBin, source: 'external', expectedVersion };
  }

  const bundled = await resolveBundledBinary(options.manifest, 'pilot-server');
  if (bundled && !(options.allowExternal && options.explicit)) {
    return { bin: bundled, source: 'bundled', expectedVersion };
  }

  if (options.explicit) {
    return resolveExternal();
  }

  const downloaded = await downloadSidecarBinary({
    name: 'pilot-server',
    sidecar: options.sidecar,
  });
  if (downloaded) return downloaded;

  if (!options.allowExternal) {
    throw new Error(
      'Bundled pilot-server binary missing and download failed. Use --allow-external.',
    );
  }

  return resolveExternal();
}

export async function resolveOpencodeBin(
  options: ResolveBinaryOptions,
): Promise<ResolvedBinary> {
  if (options.explicit && !options.allowExternal) {
    throw new Error('opencode-bin requires --allow-external');
  }
  if (
    options.explicit &&
    options.source !== 'auto' &&
    options.source !== 'external'
  ) {
    throw new Error('opencode-bin requires --opencode-source external or auto');
  }

  const expectedVersion = await resolveExpectedVersion(
    options.manifest,
    'opencode',
  );
  const resolveExternal = async (): Promise<ResolvedBinary> => {
    if (!options.allowExternal) {
      throw new Error('External opencode requires --allow-external');
    }
    if (options.explicit) {
      const resolved = resolveBinPath(options.explicit);
      if (
        (resolved.includes('/') || resolved.startsWith('.')) &&
        !(await fileExists(resolved))
      ) {
        throw new Error(`opencode-bin not found: ${resolved}`);
      }
      return { bin: resolved, source: 'external', expectedVersion };
    }
    return { bin: 'opencode', source: 'external', expectedVersion };
  };

  if (options.source === 'bundled') {
    const bundled = await resolveBundledBinary(options.manifest, 'opencode');
    if (!bundled) {
      throw new Error('Bundled opencode binary missing.');
    }
    return { bin: bundled, source: 'bundled', expectedVersion };
  }

  if (options.source === 'downloaded') {
    const downloaded = await downloadSidecarBinary({
      name: 'opencode',
      sidecar: options.sidecar,
    });
    if (downloaded) return downloaded;
    const opencodeDownloaded = await resolveOpencodeDownload(
      options.sidecar,
      expectedVersion,
    );
    return { bin: opencodeDownloaded, source: 'downloaded', expectedVersion };
  }

  if (options.source === 'external') {
    return resolveExternal();
  }

  const bundled = await resolveBundledBinary(options.manifest, 'opencode');
  if (bundled && !(options.allowExternal && options.explicit)) {
    return { bin: bundled, source: 'bundled', expectedVersion };
  }

  if (options.explicit) {
    return resolveExternal();
  }

  const downloaded = await downloadSidecarBinary({
    name: 'opencode',
    sidecar: options.sidecar,
  });
  if (downloaded) return downloaded;

  try {
    const opencodeDownloaded = await resolveOpencodeDownload(
      options.sidecar,
      expectedVersion,
    );
    return { bin: opencodeDownloaded, source: 'downloaded', expectedVersion };
  } catch (downloadErr) {
    if (!options.allowExternal) {
      const reason =
        downloadErr instanceof Error
          ? downloadErr.message
          : String(downloadErr);
      throw new Error(
        `Bundled opencode binary missing and download failed: ${reason}. Use --allow-external.`,
      );
    }
  }

  return resolveExternal();
}

export async function resolveBridgeBin(
  options: ResolveBinaryOptions,
): Promise<ResolvedBinary> {
  if (options.explicit && !options.allowExternal) {
    throw new Error('bridge-bin requires --allow-external');
  }
  if (
    options.explicit &&
    options.source !== 'auto' &&
    options.source !== 'external'
  ) {
    throw new Error('bridge-bin requires --sidecar-source external or auto');
  }

  const expectedVersion = await resolveExpectedVersion(
    options.manifest,
    'bridge',
  );
  const resolveExternal = async (): Promise<ResolvedBinary> => {
    if (!options.allowExternal) {
      throw new Error('External bridge requires --allow-external');
    }
    if (options.explicit) {
      const resolved = resolveBinPath(options.explicit);
      if (
        (resolved.includes('/') || resolved.startsWith('.')) &&
        !(await fileExists(resolved))
      ) {
        throw new Error(`bridge-bin not found: ${resolved}`);
      }
      return { bin: resolved, source: 'external', expectedVersion };
    }
    throw new Error('bridge binary not found.');
  };

  if (options.source === 'bundled') {
    const bundled = await resolveBundledBinary(options.manifest, 'bridge');
    if (!bundled) {
      throw new Error('Bundled bridge binary missing.');
    }
    return { bin: bundled, source: 'bundled', expectedVersion };
  }

  if (options.source === 'downloaded') {
    const downloaded = await downloadSidecarBinary({
      name: 'bridge',
      sidecar: options.sidecar,
    });
    if (!downloaded) {
      throw new Error('bridge download failed.');
    }
    return downloaded;
  }

  if (options.source === 'external') {
    return resolveExternal();
  }

  const workspaceBin = await resolveWorkspaceBin('pilot-bridge');
  if (workspaceBin) {
    return { bin: workspaceBin, source: 'external', expectedVersion };
  }

  const bundled = await resolveBundledBinary(options.manifest, 'bridge');
  if (bundled && !(options.allowExternal && options.explicit)) {
    return { bin: bundled, source: 'bundled', expectedVersion };
  }

  if (options.explicit) {
    return resolveExternal();
  }

  const downloaded = await downloadSidecarBinary({
    name: 'bridge',
    sidecar: options.sidecar,
  });
  if (downloaded) return downloaded;

  if (!options.allowExternal) {
    throw new Error(
      'Bundled bridge binary missing and download failed. Use --allow-external.',
    );
  }

  return resolveExternal();
}
