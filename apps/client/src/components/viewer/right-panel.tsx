/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect } from 'react';
import {
  Monitor,
  PanelTop,
  ChevronsRight,
  X,
  Globe,
  TerminalSquare,
  ScrollText,
  Loader2,
} from 'lucide-react';
import { t } from '@/i18n';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SandboxView } from '@/components/sandbox/sandbox-view';
import { ContentViewer } from './content-viewer';
import { LogViewer } from './log-viewer';
import { useViewerStore, FULLSCREEN_MODES } from '@/stores/viewer-store';
import type { RightPanelMode } from '@/stores/viewer-store';
import { useDebugStore } from '@/stores/debug-store';
import { useActiveConnection } from '@/hooks/use-connection';
import { useOpencodeWebBridge } from '@/hooks/use-opencode-web-bridge';
import { useSandboxState } from '@/hooks/use-sandbox';

// ---------------------------------------------------------------------------
// Fullscreen header (OpenCode / Terminal modes)
// ---------------------------------------------------------------------------

function FullscreenHeader({
  title,
  icon: Icon,
  onClose,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onClose: () => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="h-7 w-7 p-0"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">{t('common.close')}</span>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RightPanel() {
  const mode = useViewerStore((s) => s.mode);
  const panelVisibility = useViewerStore((s) => s.panelVisibility);
  const setMode = useViewerStore((s) => s.setMode);
  const expandPanel = useViewerStore((s) => s.expandPanel);
  const collapsePanel = useViewerStore((s) => s.collapsePanel);
  const exitFullscreen = useViewerStore((s) => s.exitFullscreen);
  const isFullscreen = FULLSCREEN_MODES.has(mode);
  const debugEnabled = useDebugStore((s) => s.enabled);
  const { endpoints, isRemote } = useActiveConnection();
  const opencodeBridge = useOpencodeWebBridge();
  const sandboxStatus = useSandboxState();

  // Keyboard shortcut: Cmd/Ctrl + Shift + V to toggle desktop/viewer
  useEffect(() => {
    if (sandboxStatus !== 'running') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        if (mode !== 'desktop' && mode !== 'viewer') return;
        e.preventDefault();
        if (panelVisibility === 'collapsed') {
          expandPanel();
        }
        setMode(mode === 'desktop' ? 'viewer' : 'desktop');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, setMode, panelVisibility, expandPanel, sandboxStatus]);

  // Escape exits fullscreen modes
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, exitFullscreen]);

  // If Debug Mode is turned off while Log is open, return to Viewer.
  useEffect(() => {
    if (!debugEnabled && mode === 'log') {
      setMode('viewer');
    }
  }, [debugEnabled, mode, setMode]);

  const handleTabChange = useCallback(
    (value: string) => {
      setMode(value as RightPanelMode);
    },
    [setMode],
  );

  // Fullscreen modes — show header + iframe only
  if (mode === 'opencode') {
    if (opencodeBridge.requiresBridge && opencodeBridge.status === 'starting') {
      return (
        <div className="flex h-full flex-col">
          <FullscreenHeader
            title={t('panel.opencode')}
            icon={Globe}
            onClose={exitFullscreen}
          />
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
            <div className="flex max-w-md flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p>
                {t('panel.bridge_starting')}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (opencodeBridge.requiresBridge && opencodeBridge.status === 'error') {
      return (
        <div className="flex h-full flex-col">
          <FullscreenHeader
            title={t('panel.opencode')}
            icon={Globe}
            onClose={exitFullscreen}
          />
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
            <div className="max-w-md text-sm text-muted-foreground">
              {opencodeBridge.errorMessage ?? t('panel.bridge_error')}
            </div>
          </div>
        </div>
      );
    }

    if (!opencodeBridge.iframeUrl) {
      return (
        <div className="flex h-full flex-col">
          <FullscreenHeader
            title={t('panel.opencode')}
            icon={Globe}
            onClose={exitFullscreen}
          />
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
            <div className="max-w-md text-sm text-muted-foreground">
              {t('panel.bridge_not_ready')}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        <FullscreenHeader
          title={t('panel.opencode')}
          icon={Globe}
          onClose={exitFullscreen}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <iframe
            key={opencodeBridge.iframeKey}
            src={opencodeBridge.iframeUrl}
            title="OpenCode Web"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    );
  }

  if (mode === 'terminal') {
    if (isRemote) {
      return (
        <div className="flex h-full flex-col">
          <FullscreenHeader
            title={t('panel.terminal')}
            icon={TerminalSquare}
            onClose={exitFullscreen}
          />
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
            <div className="max-w-sm text-sm text-muted-foreground">
              {t('panel.remote_terminal_unsupported')}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
<FullscreenHeader
            title={t('panel.terminal')}
            icon={TerminalSquare}
            onClose={exitFullscreen}
          />
        <div className="min-h-0 flex-1 overflow-hidden">
          <iframe
            src={endpoints.webTerminalUrl}
            title="Web Terminal"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    );
  }

  // Normal modes — Desktop / Viewer / Log with tab switcher
  return (
    <div className="flex h-full flex-col">
      {/* Tab switcher */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <Tabs value={mode} onValueChange={handleTabChange}>
          <TabsList className="h-7">
            <TabsTrigger value="desktop" className="h-6 gap-1 px-2 text-xs">
              <Monitor className="h-3 w-3" />
              {t('panel.desktop')}
            </TabsTrigger>
            <TabsTrigger value="viewer" className="h-6 gap-1 px-2 text-xs">
              <PanelTop className="h-3 w-3" />
              {t('panel.viewer')}
            </TabsTrigger>
            {debugEnabled && (
              <TabsTrigger value="log" className="h-6 gap-1 px-2 text-xs">
                <ScrollText className="h-3 w-3" />
                {t('panel.log')}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={collapsePanel}
          title={t('panel.collapse')}
        >
          <ChevronsRight className="h-4 w-4" />
          <span className="sr-only">{t('panel.collapse')}</span>
        </Button>
      </div>

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'desktop' && <SandboxView />}
        {mode === 'viewer' && <ContentViewer />}
        {mode === 'log' && debugEnabled && <LogViewer />}
      </div>
    </div>
  );
}
