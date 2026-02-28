/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PanelImperativeHandle, PanelSize } from 'react-resizable-panels';
import {
  Monitor,
  Settings,
  FolderOpen,
  Copy,
  Check,
  ChevronDown,
  ChevronsLeft,
  Play,
  Square,
  Loader2,
  CircleX,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatPanel } from '@/components/chat/chat-panel';
import { RightPanel } from '@/components/viewer/right-panel';
import { SettingsSheet } from '@/components/config/settings-sheet';
import { ProjectPickerDialog } from '@/components/project/project-picker-dialog';
import { ServerStatusBar } from '@/components/status/server-status-bar';
import { SandboxStatusBadge } from '@/components/sandbox/status-badge';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useConfigStore } from '@/stores/config-store';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { useViewerStore, FULLSCREEN_MODES } from '@/stores/viewer-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useActiveConnection } from '@/hooks/use-connection';
import { useTransientFlag } from '@/hooks/use-transient-flag';
import {
  useDockerCheck,
  useSandboxStatus,
  useSandboxState,
  useStartSandbox,
  useStopSandbox,
  useCancelSandboxStart,
} from '@/hooks/use-sandbox';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';
import { useUpdateCheck } from '@/hooks/use-update-check';

const SANDBOX_HOME_PREFIX = '/home/deck/';

function normalizeDirectoryPath(path: string): string {
  return path.replace(/\/+$/, '');
}

function toRelativeDirectory(path: string): string {
  const normalized = normalizeDirectoryPath(path);
  if (normalized.startsWith(SANDBOX_HOME_PREFIX)) {
    return normalized.slice(SANDBOX_HOME_PREFIX.length);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function CockpitLayout() {
  const qc = useQueryClient();
  const sandboxStatus = useSandboxState(); // Use computed hook
  const isSandboxMutating = useSandboxStore((s) => s.isMutating);
  const setDockerAvailable = useSandboxStore((s) => s.setDockerAvailable);
  const setError = useSandboxStore((s) => s.setError);
  const openSettings = useConfigStore((s) => s.openSettings);
  const setMcpDialogOpen = useChatStore((s) => s.setMcpDialogOpen);
  const openProjectPicker = useProjectStore((s) => s.openProjectPicker);
  const currentDirectory = useProjectStore((s) => s.currentDirectory);
  const viewerMode = useViewerStore((s) => s.mode);
  const panelVisibility = useViewerStore((s) => s.panelVisibility);
  const togglePanel = useViewerStore((s) => s.togglePanel);
  const expandPanel = useViewerStore((s) => s.expandPanel);
  const collapsePanel = useViewerStore((s) => s.collapsePanel);
  const startSandbox = useStartSandbox();
  const stopSandbox = useStopSandbox();
  const cancelPull = useCancelSandboxStart();
  const profiles = useConnectionStore((s) => s.profiles);
  const setActiveProfile = useConnectionStore((s) => s.setActiveProfile);
  const switchNonce = useConnectionStore((s) => s.switchNonce);
  const { profile, isRemote, isLocal } = useActiveConnection();
  const { active: pathCopied, trigger: triggerPathCopied } =
    useTransientFlag(1200);

  useUpdateCheck();
  const previousSwitchNonceRef = useRef<number>(switchNonce);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);

  const isFullscreen = FULLSCREEN_MODES.has(viewerMode);

  // Check Docker availability on mount
  const { data: dockerInfo } = useDockerCheck();

  // Poll sandbox container status
  useSandboxStatus();

  // Sync Docker check result
  useEffect(() => {
    if (!isLocal) return;
    if (dockerInfo) {
      setDockerAvailable(dockerInfo.available);
      if (!dockerInfo.available && dockerInfo.error) {
        setError(`Docker not available: ${dockerInfo.error}`);
      }
    }
  }, [dockerInfo, isLocal, setDockerAvailable, setError]);

  // Reset state and refetch on connection profile switch.
  useEffect(() => {
    if (previousSwitchNonceRef.current === switchNonce) return;
    previousSwitchNonceRef.current = switchNonce;

    useChatStore.getState().reset();
    useProjectStore.getState().reset();
    useViewerStore.getState().reset();
    useSandboxStore.getState().reset();

    void qc.invalidateQueries({ queryKey: ['sessions'] });
    void qc.invalidateQueries({ queryKey: ['config'] });
    void qc.invalidateQueries({ queryKey: ['project'] });
    void qc.invalidateQueries({ queryKey: ['server-status'] });
    void qc.invalidateQueries({ queryKey: ['commands'] });
    void qc.invalidateQueries({ queryKey: ['sandbox'] });
  }, [switchNonce, qc]);

  // Derive a short display name from the current directory
  const projectDisplayName = currentDirectory
    ? (toRelativeDirectory(currentDirectory).split('/').pop() ??
      currentDirectory)
    : null;
  const isProjectDirectoryDetecting =
    !currentDirectory &&
    (sandboxStatus === 'pulling' ||
      sandboxStatus === 'starting' ||
      sandboxStatus === 'running');
  const projectButtonLabel =
    projectDisplayName ??
    (isProjectDirectoryDetecting
      ? t('layout.detecting_project')
      : t('layout.open_project'));
  const projectTooltipLabel =
    currentDirectory ??
    (isProjectDirectoryDetecting
      ? t('layout.detecting_project_hint')
      : t('layout.no_project'));

  const handleCopyPath = useCallback(async () => {
    if (!currentDirectory) return;
    try {
      await navigator.clipboard.writeText(currentDirectory);
      triggerPathCopied();
      toast.success(t('layout.project_path_copied'));
    } catch {
      toast.error(t('layout.project_path_copy_failed'));
    }
  }, [currentDirectory, triggerPathCopied]);

  const handleSandboxAction = useCallback(() => {
    if (sandboxStatus === 'running') {
      stopSandbox.mutate(undefined);
      return;
    }
    if (sandboxStatus === 'idle' || sandboxStatus === 'error') {
      startSandbox.mutate(undefined);
    }
  }, [sandboxStatus, stopSandbox, startSandbox]);

  const sandboxActionDisabled =
    isSandboxMutating ||
    sandboxStatus === 'checking' ||
    sandboxStatus === 'connecting' ||
    sandboxStatus === 'pulling' ||
    sandboxStatus === 'starting' ||
    sandboxStatus === 'stopping';

  useEffect(() => {
    if (isFullscreen) return;
    if (panelVisibility === 'collapsed') {
      rightPanelRef.current?.collapse();
      return;
    }
    rightPanelRef.current?.expand();
  }, [isFullscreen, panelVisibility]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey) return;
      if (event.code !== 'Backslash' && event.key !== '\\') return;
      if (isFullscreen) return;
      event.preventDefault();
      togglePanel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePanel, isFullscreen]);

  useEffect(() => {
    if (isFullscreen && panelVisibility === 'collapsed') {
      expandPanel();
    }
  }, [isFullscreen, panelVisibility, expandPanel]);

  const handleRightPanelResize = useCallback(
    (panelSize: PanelSize) => {
      if (isFullscreen) return;
      const isCollapsedByDrag = panelSize.asPercentage <= 0.5;
      if (isCollapsedByDrag) {
        if (panelVisibility !== 'collapsed') collapsePanel();
        return;
      }
      if (panelVisibility !== 'expanded') expandPanel();
    },
    [isFullscreen, panelVisibility, collapsePanel, expandPanel],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" />
          <span className="shrink-0 text-sm font-bold">
            Deck<span className="text-primary">AI</span>
          </span>
          <Separator orientation="vertical" className="mx-1 h-4 shrink-0" />
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openProjectPicker}
                  aria-label="Open project picker"
                  className="h-7 max-w-[360px] gap-1 px-2 text-xs font-normal"
                >
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{projectButtonLabel}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {projectTooltipLabel}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {currentDirectory && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCopyPath()}
                    aria-label="Copy project path"
                    className="h-7 w-7 shrink-0 p-0"
                  >
                    {pathCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {pathCopied ? t('common.copied') : t('common.copy_path')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {sandboxStatus === 'running' && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4 shrink-0" />
              <div className="min-w-0">
                <ServerStatusBar
                  onOpenMcpDialog={() => setMcpDialogOpen(true)}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('layout.switch_connection')}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                <span className="max-w-[180px] truncate">{profile.name}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px]">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('layout.connection_profiles')}
              </div>
              {profiles.map((connectionProfile) => (
                <DropdownMenuItem
                  key={connectionProfile.id}
                  onSelect={() => setActiveProfile(connectionProfile.id)}
                  className="text-xs"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{connectionProfile.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {connectionProfile.type === 'remote' ? t('common.remote') : t('common.local')}
                    </span>
                  </div>
                  {connectionProfile.id === profile.id && (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open sandbox controls"
                className="inline-flex items-center gap-1 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <SandboxStatusBadge status={sandboxStatus} />
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[190px]">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {isRemote ? t('layout.remote_controls') : t('layout.sandbox_controls')}
              </div>
              <DropdownMenuItem
                onSelect={() => handleSandboxAction()}
                disabled={sandboxActionDisabled}
                className="text-xs"
              >
                {sandboxStatus === 'running' ? (
                  <>
                    <Square className="h-3.5 w-3.5 text-destructive" />
                    {isRemote ? t('layout.disconnect_remote') : t('layout.stop_sandbox')}
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 text-green-500" />
                    {isRemote ? t('layout.connect_remote') : t('layout.start_sandbox')}
                  </>
                )}
              </DropdownMenuItem>
              {sandboxStatus === 'pulling' && (
                <DropdownMenuItem
                  onSelect={() => cancelPull()}
                  className="text-xs"
                >
                  <CircleX className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('sandbox.cancel_pull')}
                </DropdownMenuItem>
              )}
              {sandboxActionDisabled && sandboxStatus !== 'pulling' && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('layout.sandbox_state_changing')}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openSettings()}
            aria-label={t('layout.open_settings')}
            className="h-7 w-7 p-0"
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">{t('common.settings')}</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {isFullscreen ? (
          /* Fullscreen mode — right panel takes the entire width */
          <RightPanel />
        ) : (
          <>
            {/* Normal split mode — Chat + Right Panel */}
            <ResizablePanelGroup orientation="horizontal">
              {/* Left: Chat */}
              <ResizablePanel
                defaultSize="100%"
                minSize="35%"
                maxSize="100%"
                className="min-h-0 overflow-hidden"
              >
                <div className="h-full min-h-0 overflow-hidden">
                  <ChatPanel />
                </div>
              </ResizablePanel>

              <ResizableHandle
                withHandle
                className={cn(
                  panelVisibility === 'collapsed' && 'pointer-events-none opacity-0',
                )}
              />

              {/* Right: Desktop / Content Viewer */}
              <ResizablePanel
                panelRef={rightPanelRef}
                collapsible
                minSize="50%"
                collapsedSize="0%"
                onResize={handleRightPanelResize}
              >
                <RightPanel />
              </ResizablePanel>
            </ResizablePanelGroup>

            {panelVisibility === 'collapsed' && (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={expandPanel}
                  className="pointer-events-auto h-8 w-6 rounded-md border-border/70 bg-background/95 shadow-xs"
                  aria-label={t('panel.expand')}
                  title={t('panel.expand')}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Settings panel (slide-out sheet) */}
      <SettingsSheet />

      {/* Project picker dialog */}
      <ProjectPickerDialog />

      {/* Global toast container */}
      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
