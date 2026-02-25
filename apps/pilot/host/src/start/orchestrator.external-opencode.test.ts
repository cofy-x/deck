/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const binaryMocks = vi.hoisted(() => ({
  resolveOpencodeBin: vi.fn(),
  resolvePilotServerBin: vi.fn(),
  resolveBridgeBin: vi.fn(),
}));

const servicesMocks = vi.hoisted(() => ({
  createOpencodeSdkClient: vi.fn(),
  fetchBridgeHealth: vi.fn(),
  runChecks: vi.fn(),
  startBridge: vi.fn(),
  startOpencode: vi.fn(),
  startPilotServer: vi.fn(),
  verifyBridgeVersion: vi.fn(),
  verifyOpencodeVersion: vi.fn(),
  verifyPilotServer: vi.fn(),
  waitForBridgeHealthy: vi.fn(),
  waitForOpencodeHealthy: vi.fn(),
}));

const httpMocks = vi.hoisted(() => ({
  waitForHealthy: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  resolveStartConfig: vi.fn(),
}));

vi.mock('../binary.js', () => binaryMocks);
vi.mock('../services.js', () => servicesMocks);
vi.mock('../utils/http.js', () => httpMocks);
vi.mock('./config.js', () => configMocks);

import { createLogger } from '../logger.js';
import { parseArgs } from '../args.js';
import { runStartOrchestrator } from './orchestrator.js';
import type { StartConfig } from './config.js';

function createExitedChildProcess(pid: number): ChildProcess {
  const child = new EventEmitter() as unknown as ChildProcess;
  Object.assign(child, {
    pid,
    exitCode: 0,
    signalCode: null,
    stdout: null,
    stderr: null,
    kill: vi.fn(() => true),
  });
  return child;
}

function createStartConfig(overrides: Partial<StartConfig> = {}): StartConfig {
  return {
    outputJson: true,
    checkOnly: true,
    checkEvents: false,
    verbose: false,
    logFormat: 'pretty',
    detachRequested: false,
    colorEnabled: false,
    runId: 'test-run-id',
    cliVersion: '0.0.1',
    logger: createLogger({
      format: 'pretty',
      runId: 'test-run-id',
      serviceName: 'pilot',
      output: 'silent',
    }),
    logVerbose: () => undefined,
    sidecarSource: 'auto',
    opencodeSource: 'auto',
    workspace: '/tmp/workspace',
    resolvedWorkspace: '/tmp/workspace',
    explicitOpencodeBin: undefined,
    explicitPilotServerBin: undefined,
    explicitBridgeBin: undefined,
    opencodeManagedByHost: false,
    pilotManagedByHost: true,
    bridgeManagedByHost: true,
    externalPilotUrl: undefined,
    externalBridgeUrl: undefined,
    opencodeBindHost: '127.0.0.1',
    opencodePort: 4096,
    opencodeUsername: 'opencode',
    opencodePassword: 'secret',
    pilotHost: '127.0.0.1',
    pilotPort: 8787,
    bridgeHealthPort: 3005,
    pilotToken: 'pilot-token',
    pilotHostToken: 'pilot-host-token',
    approvalMode: 'auto',
    approvalTimeoutMs: 30_000,
    readOnly: false,
    corsOrigins: ['*'],
    connectHost: undefined,
    sidecar: {
      dir: '/tmp/sidecars',
      baseUrl: 'https://example.com',
      manifestUrl: 'https://example.com/manifest.json',
      target: 'darwin-arm64',
    },
    manifest: null,
    allowExternal: false,
    bridgeEnabled: false,
    bridgeRequired: false,
    opencodeBaseUrl: 'http://127.0.0.1:4096',
    opencodeConnectUrl: 'http://127.0.0.1:4096',
    pilotBaseUrl: 'http://127.0.0.1:8787',
    pilotConnectUrl: 'http://127.0.0.1:8787',
    attachCommand: 'opencode attach http://127.0.0.1:4096 --dir /tmp/workspace',
    bridgeHealthUrl: 'http://127.0.0.1:3005',
    ...overrides,
  };
}

describe('runStartOrchestrator external OpenCode mode', () => {
  beforeEach(() => {
    binaryMocks.resolveOpencodeBin.mockReset();
    binaryMocks.resolvePilotServerBin.mockReset();
    binaryMocks.resolveBridgeBin.mockReset();
    servicesMocks.createOpencodeSdkClient.mockReset();
    servicesMocks.fetchBridgeHealth.mockReset();
    servicesMocks.runChecks.mockReset();
    servicesMocks.startBridge.mockReset();
    servicesMocks.startOpencode.mockReset();
    servicesMocks.startPilotServer.mockReset();
    servicesMocks.verifyBridgeVersion.mockReset();
    servicesMocks.verifyOpencodeVersion.mockReset();
    servicesMocks.verifyPilotServer.mockReset();
    servicesMocks.waitForBridgeHealthy.mockReset();
    servicesMocks.waitForOpencodeHealthy.mockReset();
    httpMocks.waitForHealthy.mockReset();
    configMocks.resolveStartConfig.mockReset();
  });

  test('does not spawn opencode and reports managedByHost=false in payload', async () => {
    const config = createStartConfig();
    configMocks.resolveStartConfig.mockResolvedValue(config);

    binaryMocks.resolvePilotServerBin.mockResolvedValue({
      bin: '/tmp/pilot-server',
      source: 'external',
      expectedVersion: '0.0.1',
    });
    servicesMocks.createOpencodeSdkClient.mockReturnValue({
      global: { health: vi.fn() },
    });
    servicesMocks.waitForOpencodeHealthy.mockResolvedValue({ healthy: true });
    servicesMocks.startPilotServer.mockResolvedValue(
      createExitedChildProcess(12345),
    );
    httpMocks.waitForHealthy.mockResolvedValue(undefined);
    servicesMocks.verifyPilotServer.mockResolvedValue('0.0.1');
    servicesMocks.runChecks.mockResolvedValue(undefined);

    let stdout = '';
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stdout +=
          typeof chunk === 'string'
            ? chunk
            : Buffer.from(chunk).toString('utf8');
        return true;
      });

    try {
      const exitCode = await runStartOrchestrator(parseArgs(['start']));
      expect(exitCode).toBe(0);
    } finally {
      stdoutSpy.mockRestore();
    }

    expect(binaryMocks.resolveOpencodeBin).not.toHaveBeenCalled();
    expect(servicesMocks.startOpencode).not.toHaveBeenCalled();
    expect(servicesMocks.waitForOpencodeHealthy).toHaveBeenCalledTimes(1);
    expect(servicesMocks.startPilotServer).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(stdout.trim()) as {
      opencode: { managedByHost: boolean };
      pilot: { managedByHost: boolean };
      diagnostics: { binaries: { opencode: { path: string } } };
    };
    expect(payload.opencode.managedByHost).toBe(false);
    expect(payload.pilot.managedByHost).toBe(true);
    expect(payload.diagnostics.binaries.opencode.path).toBe(
      config.opencodeBaseUrl,
    );
  });

  test('fails fast when external OpenCode health check fails', async () => {
    const config = createStartConfig();
    configMocks.resolveStartConfig.mockResolvedValue(config);
    servicesMocks.createOpencodeSdkClient.mockReturnValue({
      global: { health: vi.fn() },
    });
    servicesMocks.waitForOpencodeHealthy.mockRejectedValue(
      new Error('external opencode unavailable'),
    );

    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    try {
      const exitCode = await runStartOrchestrator(parseArgs(['start']));
      expect(exitCode).toBe(1);
    } finally {
      stderrSpy.mockRestore();
    }

    expect(binaryMocks.resolveOpencodeBin).not.toHaveBeenCalled();
    expect(servicesMocks.startOpencode).not.toHaveBeenCalled();
    expect(servicesMocks.startPilotServer).not.toHaveBeenCalled();
    expect(servicesMocks.runChecks).not.toHaveBeenCalled();
  });

  test('uses external pilot-server without spawning local pilot-server process', async () => {
    const config = createStartConfig({
      checkOnly: true,
      pilotManagedByHost: false,
      pilotBaseUrl: 'http://127.0.0.1:9787',
      pilotConnectUrl: 'http://127.0.0.1:9787',
      pilotHost: '127.0.0.1',
      pilotPort: 9787,
      externalPilotUrl: 'http://127.0.0.1:9787',
    });
    configMocks.resolveStartConfig.mockResolvedValue(config);

    servicesMocks.createOpencodeSdkClient.mockReturnValue({
      global: { health: vi.fn() },
    });
    servicesMocks.waitForOpencodeHealthy.mockResolvedValue({ healthy: true });
    httpMocks.waitForHealthy.mockResolvedValue(undefined);
    servicesMocks.verifyPilotServer.mockResolvedValue('0.0.1');
    servicesMocks.runChecks.mockResolvedValue(undefined);

    let stdout = '';
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stdout +=
          typeof chunk === 'string'
            ? chunk
            : Buffer.from(chunk).toString('utf8');
        return true;
      });

    try {
      const exitCode = await runStartOrchestrator(parseArgs(['start']));
      expect(exitCode).toBe(0);
    } finally {
      stdoutSpy.mockRestore();
    }

    expect(binaryMocks.resolvePilotServerBin).not.toHaveBeenCalled();
    expect(servicesMocks.startPilotServer).not.toHaveBeenCalled();
    expect(httpMocks.waitForHealthy).toHaveBeenCalledWith(config.pilotBaseUrl);

    const payload = JSON.parse(stdout.trim()) as {
      pilot: { managedByHost: boolean };
      diagnostics: { binaries: { pilotServer: { path: string; source: string } } };
    };
    expect(payload.pilot.managedByHost).toBe(false);
    expect(payload.diagnostics.binaries.pilotServer.path).toBe(
      config.pilotBaseUrl,
    );
    expect(payload.diagnostics.binaries.pilotServer.source).toBe('external');
  });

  test('fails when external pilot-server strict verify fails', async () => {
    const config = createStartConfig({
      checkOnly: false,
      pilotManagedByHost: false,
      pilotBaseUrl: 'http://127.0.0.1:9787',
      pilotConnectUrl: 'http://127.0.0.1:9787',
      pilotHost: '127.0.0.1',
      pilotPort: 9787,
      externalPilotUrl: 'http://127.0.0.1:9787',
    });
    configMocks.resolveStartConfig.mockResolvedValue(config);
    servicesMocks.createOpencodeSdkClient.mockReturnValue({
      global: { health: vi.fn() },
    });
    servicesMocks.waitForOpencodeHealthy.mockResolvedValue({ healthy: true });
    httpMocks.waitForHealthy.mockResolvedValue(undefined);
    servicesMocks.verifyPilotServer.mockRejectedValue(
      new Error('workspace mismatch'),
    );

    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    try {
      const exitCode = await runStartOrchestrator(parseArgs(['start']));
      expect(exitCode).toBe(1);
    } finally {
      stderrSpy.mockRestore();
    }

    expect(servicesMocks.startPilotServer).not.toHaveBeenCalled();
  });

  test('uses external bridge without spawning local bridge process', async () => {
    const config = createStartConfig({
      checkOnly: true,
      bridgeEnabled: true,
      bridgeManagedByHost: false,
      bridgeHealthUrl: 'http://127.0.0.1:3905',
      bridgeHealthPort: 3905,
      externalBridgeUrl: 'http://127.0.0.1:3905',
    });
    configMocks.resolveStartConfig.mockResolvedValue(config);
    binaryMocks.resolvePilotServerBin.mockResolvedValue({
      bin: '/tmp/pilot-server',
      source: 'external',
      expectedVersion: '0.0.1',
    });
    servicesMocks.createOpencodeSdkClient.mockReturnValue({
      global: { health: vi.fn() },
    });
    servicesMocks.waitForOpencodeHealthy.mockResolvedValue({ healthy: true });
    servicesMocks.startPilotServer.mockResolvedValue(
      createExitedChildProcess(23456),
    );
    httpMocks.waitForHealthy.mockResolvedValue(undefined);
    servicesMocks.verifyPilotServer.mockResolvedValue('0.0.1');
    servicesMocks.waitForBridgeHealthy.mockResolvedValue({
      ok: true,
      channels: {},
      opencode: { healthy: true, url: config.opencodeBaseUrl },
      timestamp: Date.now(),
    });
    servicesMocks.runChecks.mockResolvedValue(undefined);

    let stdout = '';
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stdout +=
          typeof chunk === 'string'
            ? chunk
            : Buffer.from(chunk).toString('utf8');
        return true;
      });

    try {
      const exitCode = await runStartOrchestrator(parseArgs(['start']));
      expect(exitCode).toBe(0);
    } finally {
      stdoutSpy.mockRestore();
    }

    expect(binaryMocks.resolveBridgeBin).not.toHaveBeenCalled();
    expect(servicesMocks.startBridge).not.toHaveBeenCalled();
    expect(servicesMocks.waitForBridgeHealthy).toHaveBeenCalledWith(
      config.bridgeHealthUrl,
    );

    const payload = JSON.parse(stdout.trim()) as {
      bridge: { managedByHost: boolean; healthUrl: string };
    };
    expect(payload.bridge.managedByHost).toBe(false);
    expect(payload.bridge.healthUrl).toBe(config.bridgeHealthUrl);
  });

  test('continues when external bridge health fails and bridge is not required', async () => {
    const config = createStartConfig({
      checkOnly: false,
      bridgeEnabled: true,
      bridgeManagedByHost: false,
      bridgeRequired: false,
      bridgeHealthUrl: 'http://127.0.0.1:3905',
      bridgeHealthPort: 3905,
      externalBridgeUrl: 'http://127.0.0.1:3905',
      pilotManagedByHost: false,
      pilotBaseUrl: 'http://127.0.0.1:9787',
      pilotConnectUrl: 'http://127.0.0.1:9787',
      pilotHost: '127.0.0.1',
      pilotPort: 9787,
      externalPilotUrl: 'http://127.0.0.1:9787',
    });
    configMocks.resolveStartConfig.mockResolvedValue(config);
    servicesMocks.createOpencodeSdkClient.mockReturnValue({
      global: { health: vi.fn() },
    });
    servicesMocks.waitForOpencodeHealthy.mockResolvedValue({ healthy: true });
    httpMocks.waitForHealthy.mockResolvedValue(undefined);
    servicesMocks.verifyPilotServer.mockResolvedValue('0.0.1');
    servicesMocks.waitForBridgeHealthy.mockRejectedValue(
      new Error('bridge unavailable'),
    );

    const exitCode = await runStartOrchestrator(parseArgs(['start']));
    expect(exitCode).toBe(0);
  });

  test('fails when external bridge health fails and bridge is required', async () => {
    const config = createStartConfig({
      checkOnly: false,
      bridgeEnabled: true,
      bridgeManagedByHost: false,
      bridgeRequired: true,
      bridgeHealthUrl: 'http://127.0.0.1:3905',
      bridgeHealthPort: 3905,
      externalBridgeUrl: 'http://127.0.0.1:3905',
      pilotManagedByHost: false,
      pilotBaseUrl: 'http://127.0.0.1:9787',
      pilotConnectUrl: 'http://127.0.0.1:9787',
      pilotHost: '127.0.0.1',
      pilotPort: 9787,
      externalPilotUrl: 'http://127.0.0.1:9787',
    });
    configMocks.resolveStartConfig.mockResolvedValue(config);
    servicesMocks.createOpencodeSdkClient.mockReturnValue({
      global: { health: vi.fn() },
    });
    servicesMocks.waitForOpencodeHealthy.mockResolvedValue({ healthy: true });
    httpMocks.waitForHealthy.mockResolvedValue(undefined);
    servicesMocks.verifyPilotServer.mockResolvedValue('0.0.1');
    servicesMocks.waitForBridgeHealthy.mockRejectedValue(
      new Error('bridge unavailable'),
    );

    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    try {
      const exitCode = await runStartOrchestrator(parseArgs(['start']));
      expect(exitCode).toBe(1);
    } finally {
      stderrSpy.mockRestore();
    }
  });

  test('returns immediately after readiness when all services are external', async () => {
    const config = createStartConfig({
      checkOnly: false,
      opencodeManagedByHost: false,
      pilotManagedByHost: false,
      bridgeEnabled: true,
      bridgeManagedByHost: false,
      pilotBaseUrl: 'http://127.0.0.1:9787',
      pilotConnectUrl: 'http://127.0.0.1:9787',
      pilotHost: '127.0.0.1',
      pilotPort: 9787,
      externalPilotUrl: 'http://127.0.0.1:9787',
      bridgeHealthUrl: 'http://127.0.0.1:3905',
      bridgeHealthPort: 3905,
      externalBridgeUrl: 'http://127.0.0.1:3905',
    });
    configMocks.resolveStartConfig.mockResolvedValue(config);
    servicesMocks.createOpencodeSdkClient.mockReturnValue({
      global: { health: vi.fn() },
    });
    servicesMocks.waitForOpencodeHealthy.mockResolvedValue({ healthy: true });
    httpMocks.waitForHealthy.mockResolvedValue(undefined);
    servicesMocks.verifyPilotServer.mockResolvedValue('0.0.1');
    servicesMocks.waitForBridgeHealthy.mockResolvedValue({
      ok: true,
      channels: {},
      opencode: { healthy: true, url: config.opencodeBaseUrl },
      timestamp: Date.now(),
    });

    const exitCode = await runStartOrchestrator(parseArgs(['start']));
    expect(exitCode).toBe(0);
    expect(servicesMocks.runChecks).not.toHaveBeenCalled();
    expect(servicesMocks.startOpencode).not.toHaveBeenCalled();
    expect(servicesMocks.startPilotServer).not.toHaveBeenCalled();
    expect(servicesMocks.startBridge).not.toHaveBeenCalled();
  });
});
