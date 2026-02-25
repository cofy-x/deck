/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  resolveBridgeBin,
  resolveOpencodeBin,
  resolvePilotServerBin,
} from '../binary.js';
import {
  createOpencodeSdkClient,
  fetchBridgeHealth,
  runChecks,
  startBridge,
  startOpencode,
  startPilotServer,
  verifyBridgeVersion,
  verifyOpencodeVersion,
  verifyPilotServer,
  waitForBridgeHealthy,
  waitForOpencodeHealthy,
} from '../services.js';
import type {
  BinarySource,
  HttpHeaders,
  ParsedArgs,
  StartPayload,
} from '../types/index.js';
import { waitForHealthy } from '../utils/http.js';
import { encodeBasicAuth } from '../utils/network.js';
import { resolveStartConfig } from './config.js';
import { describeExit, StartLifecycleManager } from './lifecycle.js';

async function printReadyPayload(
  payload: StartPayload,
  outputJson: boolean,
  logFormat: 'pretty' | 'json',
): Promise<void> {
  if (outputJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  if (logFormat === 'json') {
    return;
  }
  process.stdout.write('Pilot host running\n');
  process.stdout.write(`Run ID: ${payload.runId}\n`);
  process.stdout.write(`Workspace: ${payload.workspace}\n`);
  process.stdout.write(`OpenCode: ${payload.opencode.baseUrl}\n`);
  process.stdout.write(`OpenCode connect URL: ${payload.opencode.connectUrl}\n`);
  if (payload.opencode.username && payload.opencode.password) {
    process.stdout.write(
      `OpenCode auth: ${payload.opencode.username} / ${payload.opencode.password}\n`,
    );
  }
  process.stdout.write(`Pilot server: ${payload.pilot.baseUrl}\n`);
  process.stdout.write(`Pilot connect URL: ${payload.pilot.connectUrl}\n`);
  process.stdout.write(`Client token: ${payload.pilot.token}\n`);
  process.stdout.write(`Host token: ${payload.pilot.hostToken}\n`);
}

function printDetachSummary(
  payload: StartPayload,
  lifecycle: StartLifecycleManager,
  attachCommand: string,
): void {
  const lines = [
    'Detached. Services still running:',
    ...lifecycle.handles.map(
      (handle) => `- ${handle.name} (pid ${handle.child.pid ?? 'unknown'})`,
    ),
    `Pilot URL: ${payload.pilot.connectUrl}`,
    `Pilot Token: ${payload.pilot.token}`,
    `OpenCode URL: ${payload.opencode.connectUrl}`,
    `Attach: ${attachCommand}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

export async function runStartOrchestrator(args: ParsedArgs): Promise<number> {
  const config = await resolveStartConfig(args);
  const lifecycle = new StartLifecycleManager(config.logger);
  let pilotActualVersion: string | undefined;
  let bridgeActualVersion: string | undefined;
  let exitCompleted = false;
  let completeExit: (code: number) => void = () => undefined;
  const exitCodePromise = new Promise<number>((resolve) => {
    completeExit = (code: number) => {
      if (exitCompleted) return;
      exitCompleted = true;
      resolve(code);
    };
  });
  const finish = (code: number): void => {
    completeExit(code);
  };

  const fatalExit = (name: string, code: number | null, signal: NodeJS.Signals | null) => {
    if (lifecycle.isShuttingDown || lifecycle.isDetached) return;
    const details = describeExit(code, signal);
    config.logger.error(
      'Process exited',
      {
        reason: details.reason,
        code: details.code ?? undefined,
        signal: details.signal ?? undefined,
      },
      name,
    );
    void lifecycle.shutdown().then(() => finish(code ?? 1));
  };

  const spawnError = (
    name: string,
    error: Error,
    required: boolean,
  ): void => {
    if (lifecycle.isShuttingDown || lifecycle.isDetached) return;
    if (!required) {
      config.logger.warn(
        'Process failed to start, continuing',
        { error: error.message },
        name,
      );
      return;
    }
    config.logger.error('Process failed to start', { error: error.message }, name);
    void lifecycle.shutdown().then(() => finish(1));
  };

  try {
    config.logger.info(
      'Run starting',
      {
        workspace: config.resolvedWorkspace,
        logFormat: config.logFormat,
        runId: config.runId,
      },
      'pilot',
    );

    config.logVerbose(`cli version: ${config.cliVersion}`);
    config.logVerbose(`sidecar target: ${config.sidecar.target ?? 'unknown'}`);
    config.logVerbose(`sidecar dir: ${config.sidecar.dir}`);
    config.logVerbose(`sidecar source: ${config.sidecarSource}`);
    config.logVerbose(`opencode source: ${config.opencodeSource}`);
    config.logVerbose(`allow external: ${config.allowExternal ? 'true' : 'false'}`);

    const opencodeBinary = config.opencodeManagedByHost
      ? await resolveOpencodeBin({
          explicit: config.explicitOpencodeBin,
          manifest: config.manifest,
          allowExternal: config.allowExternal,
          sidecar: config.sidecar,
          source: config.opencodeSource,
        })
      : null;
    const pilotServerBinary = config.pilotManagedByHost
      ? await resolvePilotServerBin({
          explicit: config.explicitPilotServerBin,
          manifest: config.manifest,
          allowExternal: config.allowExternal,
          sidecar: config.sidecar,
          source: config.sidecarSource,
        })
      : null;
    const bridgeBinary = config.bridgeEnabled && config.bridgeManagedByHost
      ? await resolveBridgeBin({
          explicit: config.explicitBridgeBin,
          manifest: config.manifest,
          allowExternal: config.allowExternal,
          sidecar: config.sidecar,
          source: config.sidecarSource,
        })
      : null;

    if (opencodeBinary) {
      config.logVerbose(
        `opencode bin: ${opencodeBinary.bin} (${opencodeBinary.source})`,
      );
    } else {
      config.logVerbose(`external opencode url: ${config.opencodeBaseUrl}`);
    }
    if (pilotServerBinary) {
      config.logVerbose(
        `pilot-server bin: ${pilotServerBinary.bin} (${pilotServerBinary.source})`,
      );
    } else {
      config.logVerbose(`external pilot url: ${config.pilotBaseUrl}`);
    }
    if (bridgeBinary) {
      config.logVerbose(`bridge bin: ${bridgeBinary.bin} (${bridgeBinary.source})`);
    } else if (config.bridgeEnabled) {
      config.logVerbose(`external bridge url: ${config.bridgeHealthUrl}`);
    }

    let opencodeActualVersion: string | undefined;
    const authHeaders: HttpHeaders | undefined =
      config.opencodeUsername && config.opencodePassword
        ? {
            Authorization: `Basic ${encodeBasicAuth(config.opencodeUsername, config.opencodePassword)}`,
          }
        : undefined;
    const opencodeClient = createOpencodeSdkClient({
      baseUrl: config.opencodeBaseUrl,
      directory: config.resolvedWorkspace,
      headers: authHeaders,
    });
    if (config.opencodeManagedByHost) {
      if (!opencodeBinary) {
        throw new Error('OpenCode binary missing.');
      }
      opencodeActualVersion = await verifyOpencodeVersion(opencodeBinary);
      const opencodeChild = await startOpencode({
        bin: opencodeBinary.bin,
        workspace: config.resolvedWorkspace,
        bindHost: config.opencodeBindHost,
        port: config.opencodePort,
        username: config.opencodeUsername,
        password: config.opencodePassword,
        corsOrigins: config.corsOrigins.length ? config.corsOrigins : ['*'],
        logger: config.logger,
        runId: config.runId,
        logFormat: config.logFormat,
      });
      lifecycle.register('opencode', opencodeChild);
      config.logger.info(
        'Process spawned',
        { pid: opencodeChild.pid ?? 0 },
        'opencode',
      );
      opencodeChild.on('exit', (code, signal) =>
        fatalExit('opencode', code, signal),
      );
      opencodeChild.on('error', (error) => spawnError('opencode', error, true));
    } else {
      config.logger.info(
        'Using external OpenCode',
        { url: config.opencodeBaseUrl },
        'opencode',
      );
    }
    config.logger.info(
      'Waiting for health',
      { url: config.opencodeBaseUrl },
      'opencode',
    );
    await waitForOpencodeHealthy(opencodeClient);
    config.logger.info('Healthy', { url: config.opencodeBaseUrl }, 'opencode');

    if (config.pilotManagedByHost) {
      if (!pilotServerBinary) {
        throw new Error('Pilot server binary missing.');
      }
      const pilotChild = await startPilotServer({
        bin: pilotServerBinary.bin,
        host: config.pilotHost,
        port: config.pilotPort,
        workspace: config.resolvedWorkspace,
        token: config.pilotToken,
        hostToken: config.pilotHostToken,
        approvalMode: config.approvalMode,
        approvalTimeoutMs: config.approvalTimeoutMs,
        readOnly: config.readOnly,
        corsOrigins: config.corsOrigins.length ? config.corsOrigins : ['*'],
        opencodeUrl: config.opencodeBaseUrl,
        opencodeDirectory: config.resolvedWorkspace,
        opencodeUsername: config.opencodeUsername,
        opencodePassword: config.opencodePassword,
        bridgeHealthPort: config.bridgeHealthPort,
        logger: config.logger,
        runId: config.runId,
        logFormat: config.logFormat,
      });
      lifecycle.register('pilot-server', pilotChild);
      config.logger.info(
        'Process spawned',
        { pid: pilotChild.pid ?? 0 },
        'pilot-server',
      );
      pilotChild.on('exit', (code, signal) =>
        fatalExit('pilot-server', code, signal),
      );
      pilotChild.on('error', (error) => spawnError('pilot-server', error, true));
    } else {
      config.logger.info(
        'Using external Pilot server',
        { url: config.pilotBaseUrl },
        'pilot-server',
      );
    }

    config.logger.info(
      'Waiting for health',
      { url: config.pilotBaseUrl },
      'pilot-server',
    );
    await waitForHealthy(config.pilotBaseUrl);
    config.logger.info('Healthy', { url: config.pilotBaseUrl }, 'pilot-server');

    pilotActualVersion = await verifyPilotServer({
      baseUrl: config.pilotBaseUrl,
      token: config.pilotToken,
      hostToken: config.pilotHostToken,
      expectedVersion: pilotServerBinary?.expectedVersion,
      expectedWorkspace: config.resolvedWorkspace,
      expectedOpencodeBaseUrl: config.opencodeBaseUrl,
      expectedOpencodeDirectory: config.resolvedWorkspace,
      expectedOpencodeUsername: config.opencodeUsername,
      expectedOpencodePassword: config.opencodePassword,
    });
    config.logVerbose(`pilot-server version: ${pilotActualVersion ?? 'unknown'}`);

    if (config.bridgeEnabled) {
      if (config.bridgeManagedByHost) {
        if (!bridgeBinary) {
          throw new Error('Bridge binary missing.');
        }
        bridgeActualVersion = await verifyBridgeVersion(bridgeBinary);
        config.logVerbose(`bridge version: ${bridgeActualVersion ?? 'unknown'}`);
        const bridgeChild = await startBridge({
          bin: bridgeBinary.bin,
          workspace: config.resolvedWorkspace,
          opencodeUrl: config.opencodeBaseUrl,
          opencodeUsername: config.opencodeUsername,
          opencodePassword: config.opencodePassword,
          bridgeHealthPort: config.bridgeHealthPort,
          logger: config.logger,
          runId: config.runId,
          logFormat: config.logFormat,
        });
        lifecycle.register('bridge', bridgeChild);
        config.logger.info(
          'Process spawned',
          { pid: bridgeChild.pid ?? 0 },
          'bridge',
        );
        try {
          config.logger.info(
            'Waiting for health',
            { url: config.bridgeHealthUrl },
            'bridge',
          );
          const health = await waitForBridgeHealthy(config.bridgeHealthUrl);
          config.logger.info(
            'Healthy',
            { url: config.bridgeHealthUrl, ok: health.ok },
            'bridge',
          );
        } catch (error) {
          config.logger.warn(
            'Bridge health check failed',
            { error: String(error) },
            'bridge',
          );
        }
        const interval = setInterval(() => {
          void fetchBridgeHealth(config.bridgeHealthUrl).catch(() => undefined);
        }, 15_000);
        lifecycle.trackInterval(interval);
        bridgeChild.on('exit', (code, signal) => {
          if (config.bridgeRequired) {
            fatalExit('bridge', code, signal);
            return;
          }
          if (lifecycle.isShuttingDown || lifecycle.isDetached) return;
          const details = describeExit(code, signal);
          config.logger.warn(
            'Process exited, continuing without bridge',
            {
              reason: details.reason,
              code: details.code ?? undefined,
              signal: details.signal ?? undefined,
            },
            'bridge',
          );
        });
        bridgeChild.on('error', (error) =>
          spawnError('bridge', error, config.bridgeRequired),
        );
      } else {
        config.logger.info(
          'Using external Bridge',
          { url: config.bridgeHealthUrl },
          'bridge',
        );
        try {
          config.logger.info(
            'Waiting for health',
            { url: config.bridgeHealthUrl },
            'bridge',
          );
          const health = await waitForBridgeHealthy(config.bridgeHealthUrl);
          config.logger.info(
            'Healthy',
            { url: config.bridgeHealthUrl, ok: health.ok },
            'bridge',
          );
        } catch (error) {
          if (config.bridgeRequired) {
            throw error;
          }
          config.logger.warn(
            'Bridge health check failed',
            { error: String(error) },
            'bridge',
          );
        }
      }
    }

    const payload: StartPayload = {
      runId: config.runId,
      workspace: config.resolvedWorkspace,
      approval: {
        mode: config.approvalMode,
        timeoutMs: config.approvalTimeoutMs,
        readOnly: config.readOnly,
      },
      opencode: {
        baseUrl: config.opencodeBaseUrl,
        connectUrl: config.opencodeConnectUrl,
        managedByHost: config.opencodeManagedByHost,
        username: config.opencodeUsername,
        password: config.opencodePassword,
        bindHost: config.opencodeBindHost,
        port: config.opencodePort,
        version: opencodeActualVersion,
      },
      pilot: {
        baseUrl: config.pilotBaseUrl,
        connectUrl: config.pilotConnectUrl,
        managedByHost: config.pilotManagedByHost,
        host: config.pilotHost,
        port: config.pilotPort,
        token: config.pilotToken,
        hostToken: config.pilotHostToken,
        version: pilotActualVersion,
      },
      bridge: {
        enabled: config.bridgeEnabled,
        managedByHost: config.bridgeManagedByHost,
        version: config.bridgeEnabled ? bridgeActualVersion : undefined,
        healthPort: config.bridgeHealthPort,
        healthUrl: config.bridgeHealthUrl,
      },
      diagnostics: {
        cliVersion: config.cliVersion,
        sidecar: {
          dir: config.sidecar.dir,
          baseUrl: config.sidecar.baseUrl,
          manifestUrl: config.sidecar.manifestUrl,
          target: config.sidecar.target,
          source: config.sidecarSource,
          opencodeSource: config.opencodeSource,
          allowExternal: config.allowExternal,
        },
        binaries: {
          opencode: {
            path: opencodeBinary?.bin ?? config.opencodeBaseUrl,
            source: (opencodeBinary?.source ?? 'external') as BinarySource,
            expectedVersion: opencodeBinary?.expectedVersion,
            actualVersion: opencodeActualVersion,
          },
          pilotServer: {
            path: pilotServerBinary?.bin ?? config.pilotBaseUrl,
            source: (pilotServerBinary?.source ?? 'external') as BinarySource,
            expectedVersion: pilotServerBinary?.expectedVersion,
            actualVersion: pilotActualVersion,
          },
          bridge: !config.bridgeEnabled
            ? null
            : bridgeBinary
              ? {
                  path: bridgeBinary.bin,
                  source: bridgeBinary.source,
                  expectedVersion: bridgeBinary.expectedVersion,
                  actualVersion: bridgeActualVersion,
                }
              : {
                  path: config.bridgeHealthUrl,
                  source: 'external',
                  actualVersion: bridgeActualVersion,
                },
        },
      },
    };

    await printReadyPayload(payload, config.outputJson, config.logFormat);
    if (!config.outputJson && config.logFormat === 'json') {
      config.logger.info('Ready', { workspace: payload.workspace }, 'pilot');
    }

    const hasManagedChildren =
      config.opencodeManagedByHost ||
      config.pilotManagedByHost ||
      (config.bridgeEnabled && config.bridgeManagedByHost);
    if (!hasManagedChildren && !config.checkOnly && !config.detachRequested) {
      return 0;
    }

    if (config.detachRequested) {
      lifecycle.detach();
      if (!config.outputJson) {
        printDetachSummary(payload, lifecycle, config.attachCommand);
      }
      return 0;
    }

    if (config.checkOnly) {
      try {
        await runChecks({
          opencodeClient,
          pilotUrl: config.pilotBaseUrl,
          pilotToken: config.pilotToken,
          checkEvents: config.checkEvents,
        });
        config.logger.info('Checks ok', { checkEvents: config.checkEvents }, 'pilot');
        if (!config.outputJson && config.logFormat === 'pretty') {
          process.stdout.write('Checks: ok\n');
        }
      } catch (error) {
        config.logger.error('Checks failed', { error: String(error) }, 'pilot');
        await lifecycle.shutdown();
        return 1;
      }
      await lifecycle.shutdown();
      return 0;
    }

    const onSigint = () => void lifecycle.shutdown().then(() => finish(0));
    const onSigterm = () => void lifecycle.shutdown().then(() => finish(0));
    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);
    const exitCode = await exitCodePromise;
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
    return exitCode;
  } catch (error) {
    await lifecycle.shutdown();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    config.logger.error(
      'Run failed',
      { error: errorMessage, stack: errorStack },
      'pilot',
    );
    if (errorStack) {
      process.stderr.write(`${errorStack}\n`);
    }
    return 1;
  }
}
