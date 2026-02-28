/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect, useCallback } from 'react';
import { Monitor, Loader2, Play, AlertTriangle, RefreshCw, CircleX, ExternalLink } from 'lucide-react';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SandboxToolbar } from './sandbox-toolbar';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useViewerStore } from '@/stores/viewer-store';
import { useSandboxState, useCancelSandboxStart } from '@/hooks/use-sandbox';
import { useActiveConnection } from '@/hooks/use-connection';
import {
  daemonProbe,
  getComputerUseSystemStatus,
  startComputerUse,
  probeNoVNC,
} from '@/lib/daemon';

// ---------------------------------------------------------------------------
// Boot stages for the sandbox desktop
// ---------------------------------------------------------------------------

type BootStage =
  | 'waiting-daemon'
  | 'awaiting-manual-start'
  | 'starting-computeruse'
  | 'waiting-novnc'
  | 'ready'
  | 'error';

function assertNever(value: never): never {
  throw new Error(`Unhandled boot stage: ${String(value)}`);
}

function getStageLabel(
  stage: Exclude<
    BootStage,
    'ready' | 'error' | 'awaiting-manual-start'
  >,
): { title: string; description: string } {
  switch (stage) {
    case 'waiting-daemon':
      return {
        title: t('sandbox.boot_daemon_title'),
        description: t('sandbox.boot_daemon_desc'),
      };
    case 'starting-computeruse':
      return {
        title: t('sandbox.boot_computeruse_title'),
        description: t('sandbox.boot_computeruse_desc'),
      };
    case 'waiting-novnc':
      return {
        title: t('sandbox.boot_novnc_title'),
        description: t('sandbox.boot_novnc_desc'),
      };
    default:
      return assertNever(stage);
  }
}

// ---------------------------------------------------------------------------
// Hook: multi-stage boot sequence
// ---------------------------------------------------------------------------

function useDesktopBoot(input: {
  enabled: boolean;
  daemonBaseUrl: string;
  noVncUrl: string;
  daemonToken?: string;
  requireManualRemoteStart: boolean;
}) {
  const [stage, setStage] = useState<BootStage>('waiting-daemon');
  const [attempt, setAttempt] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!input.enabled) {
      setStage('waiting-daemon');
      setAttempt(0);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const daemonConfig = {
      baseUrl: input.daemonBaseUrl,
      noVncUrl: input.noVncUrl,
      token: input.daemonToken,
    };

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    // Step 1: Poll daemon /version until healthy
    const waitForDaemon = async (): Promise<boolean> => {
      setStage('waiting-daemon');
      let retries = 0;
      while (!cancelled && retries < 30) {
        const ok = await daemonProbe('/version', daemonConfig);
        if (ok) {
          console.info('[boot] Daemon is healthy');
          return true;
        }
        if (!cancelled) {
          setAttempt((value) => value + 1);
          retries += 1;
          await sleep(2_000);
        }
      }
      return false;
    };

    // Step 2: Check status and conditionally start computer-use
    const ensureComputerUse = async (): Promise<boolean> => {
      setStage('starting-computeruse');
      try {
        const statusResp = await getComputerUseSystemStatus(daemonConfig);
        if (statusResp.status === 'active') {
          console.info('[boot] Computer-use already active, skipping start');
          return true;
        }
      } catch {
        console.warn('[boot] Could not check computer-use status');
      }

      if (input.requireManualRemoteStart) {
        setStage('awaiting-manual-start');
        return false;
      }

      try {
        console.info('[boot] Calling POST /computeruse/start...');
        const result = await startComputerUse(daemonConfig);
        console.info('[boot] Computer-use started:', result.message);
        return true;
      } catch (error) {
        console.error('[boot] Computer-use start error:', error);
        return false;
      }
    };

    // Step 3: Poll noVNC until accessible
    const waitForNoVNC = async (): Promise<boolean> => {
      setStage('waiting-novnc');
      let retries = 0;
      while (!cancelled && retries < 30) {
        const ok = await probeNoVNC(daemonConfig);
        if (ok) {
          console.info('[boot] noVNC is accessible');
          return true;
        }
        retries += 1;
        if (!cancelled) {
          setAttempt((value) => value + 1);
          await sleep(1_500);
        }
      }
      return false;
    };

    // Run the full boot sequence
    const boot = async () => {
      setAttempt(0);

      const daemonOk = await waitForDaemon();
      if (cancelled) return;
      if (!daemonOk) {
        setStage('error');
        setErrorMsg(t('sandbox.error_daemon'));
        return;
      }

      const cuOk = await ensureComputerUse();
      if (cancelled) return;
      if (!cuOk) {
        if (input.requireManualRemoteStart) {
          return;
        }
        setStage('error');
        setErrorMsg(t('sandbox.error_computeruse'));
        return;
      }

      const vncOk = await waitForNoVNC();
      if (cancelled) return;
      if (!vncOk) {
        setStage('error');
        setErrorMsg(t('sandbox.error_novnc'));
        return;
      }

      setStage('ready');
    };

    void boot();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    input.enabled,
    input.daemonBaseUrl,
    input.noVncUrl,
    input.daemonToken,
    input.requireManualRemoteStart,
  ]);

  return { stage, attempt, errorMsg };
}

// ---------------------------------------------------------------------------
// Idle / Starting / Error states
// ---------------------------------------------------------------------------

function SandboxPlaceholder() {
  const status = useSandboxState();
  const errorMessage = useSandboxStore((s) => s.errorMessage);
  const pullPercent = useSandboxStore((s) => s.pullPercent);
  const pullLayersDone = useSandboxStore((s) => s.pullLayersDone);
  const pullLayersTotal = useSandboxStore((s) => s.pullLayersTotal);
  const setViewerMode = useViewerStore((s) => s.setMode);
  const { isRemote } = useActiveConnection();
  const cancelPull = useCancelSandboxStart();

  if (status === 'error') {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h3 className="text-lg font-semibold">
              {isRemote ? t('sandbox.remote_error') : t('sandbox.sandbox_error')}
            </h3>
            <p className="text-center text-sm text-muted-foreground">
              {errorMessage ?? t('sandbox.unknown_error')}
            </p>
            <p className="text-center text-xs text-muted-foreground">
              {t('sandbox.retry_from_chat_hint')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (
    status === 'pulling' ||
    status === 'starting' ||
    status === 'checking' ||
    status === 'connecting'
  ) {
    const progressValue =
      status === 'pulling' && pullPercent != null
        ? pullPercent
        : status === 'connecting'
          ? 45
          : status === 'pulling'
            ? 0
            : 70;

    return (
      <div className="flex h-full items-center justify-center bg-muted/30 p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">
              {status === 'connecting'
                ? t('sandbox.connecting_remote')
                : status === 'pulling'
                  ? t('sandbox.building')
                  : t('sandbox.starting_ai')}
            </h3>
            <p className="text-center text-sm text-muted-foreground">
              {status === 'connecting'
                ? t('sandbox.connecting_remote_desc')
                : status === 'pulling'
                  ? t('sandbox.building_desc')
                  : t('sandbox.starting_ai_desc')}
            </p>
            <div className="w-full space-y-1">
              <Progress value={progressValue} className="w-full" />
              {status === 'pulling' && pullLayersTotal > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  {t('sandbox.pull_layers')
                    .replace('{done}', String(pullLayersDone))
                    .replace('{total}', String(pullLayersTotal))}
                </p>
              )}
            </div>
            {status === 'pulling' && (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setViewerMode('viewer')}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {t('sandbox.view_pull_logs')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={cancelPull}
                >
                  <CircleX className="mr-1.5 h-3.5 w-3.5" />
                  {t('sandbox.cancel_pull')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-muted/30 p-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <Monitor className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            {isRemote ? t('sandbox.remote_title') : t('sandbox.local_title')}
          </h3>
          <p className="text-center text-sm text-muted-foreground">
            {isRemote
              ? t('sandbox.remote_description')
              : t('sandbox.local_description')}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            {isRemote
              ? t('sandbox.connect_from_chat_hint')
              : t('sandbox.start_from_chat_hint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boot progress view
// ---------------------------------------------------------------------------

function BootProgress({
  stage,
  attempt,
  errorMsg,
  onManualStart,
  manualStartDisabled,
}: {
  stage: Exclude<BootStage, 'ready'>;
  attempt: number;
  errorMsg: string | null;
  onManualStart: () => void;
  manualStartDisabled: boolean;
}) {
  if (stage === 'error') {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h3 className="text-lg font-semibold">{t('sandbox.boot_failed')}</h3>
            <p className="text-center text-sm text-muted-foreground">
              {errorMsg ?? t('sandbox.boot_error_default')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === 'awaiting-manual-start') {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <Monitor className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t('sandbox.services_inactive')}</h3>
            <p className="text-center text-sm text-muted-foreground">
              {t('sandbox.services_inactive_desc')}
            </p>
            <Button onClick={onManualStart} disabled={manualStartDisabled}>
              {manualStartDisabled ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {t('sandbox.start_desktop_services')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stageInfo = getStageLabel(stage);
  let progress: number;
  switch (stage) {
    case 'waiting-daemon':
      progress = Math.min(28, 5 + attempt * 5);
      break;
    case 'starting-computeruse':
      progress = 35 + Math.min(20, attempt * 3);
      break;
    case 'waiting-novnc':
      progress = 60 + Math.min(35, attempt * 5);
      break;
    default:
      progress = 50;
  }

  return (
    <div className="flex h-full items-center justify-center bg-muted/30 p-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <h3 className="text-lg font-semibold">{stageInfo.title}</h3>
          <p className="text-center text-sm text-muted-foreground">
            {stageInfo.description}
          </p>
          <Progress value={progress} className="w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sandbox View
// ---------------------------------------------------------------------------

export function SandboxView() {
  const status = useSandboxState();
  const { isRemote, endpoints, secrets } = useActiveConnection();
  const [iframeKey, setIframeKey] = useState(0);
  const [manualStartRequested, setManualStartRequested] = useState(false);

  const { stage, attempt, errorMsg } = useDesktopBoot({
    enabled: status === 'running',
    daemonBaseUrl: endpoints.daemonBaseUrl,
    noVncUrl: endpoints.noVncUrl,
    daemonToken: secrets.daemonToken,
    requireManualRemoteStart: isRemote && !manualStartRequested,
  });

  const handleRefreshIframe = useCallback(() => {
    setIframeKey((value) => value + 1);
  }, []);

  const handleManualStart = useCallback(() => {
    setManualStartRequested(true);
  }, []);

  useEffect(() => {
    if (status !== 'running') {
      setManualStartRequested(false);
    }
  }, [status]);

  if (status !== 'running') {
    return <SandboxPlaceholder />;
  }

  if (stage !== 'ready') {
    return (
      <div className="flex h-full flex-col">
        <SandboxToolbar onRefresh={handleRefreshIframe} />
        <BootProgress
          stage={stage}
          attempt={attempt}
          errorMsg={errorMsg}
          onManualStart={handleManualStart}
          manualStartDisabled={manualStartRequested}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <SandboxToolbar onRefresh={handleRefreshIframe} />
      <div className="relative flex-1 bg-black">
        <iframe
          key={iframeKey}
          id="novnc-iframe"
          src={endpoints.noVncUrl}
          title={t('sandbox.iframe_title')}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
        <div className="absolute bottom-3 right-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefreshIframe}
            className="opacity-60 hover:opacity-100"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            {t('sandbox.reload')}
          </Button>
        </div>
      </div>
    </div>
  );
}
