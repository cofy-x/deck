/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2, TerminalSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { t } from '@/i18n';
import {
  openProjectInEditor,
  type ExternalEditor,
} from '@/lib/external-editor';
import { cn } from '@/lib/utils';
import { useViewerStore } from '@/stores/viewer-store';
import type { SandboxStatusValue } from '@/stores/sandbox-store';
import vscodeLogo from '@/assets/brands/vscode.svg';
import cursorLogo from '@/assets/brands/cursor.svg';
import opencodeLogo from '@/assets/brands/opencode.svg';

const OPEN_EDITOR_PREF_KEY = 'deck.open.editor.preference';

interface ProjectOpenActionsProps {
  currentDirectory: string | null;
  isLocal: boolean;
  sandboxStatus: SandboxStatusValue;
}

function isExternalEditor(value: string | null): value is ExternalEditor {
  return value === 'vscode' || value === 'cursor';
}

function getEditorLogo(editor: ExternalEditor): string {
  return editor === 'vscode' ? vscodeLogo : cursorLogo;
}

export function ProjectOpenActions({
  currentDirectory,
  isLocal,
  sandboxStatus,
}: ProjectOpenActionsProps) {
  const viewerMode = useViewerStore((s) => s.mode);
  const switchToOpencode = useViewerStore((s) => s.switchToOpencode);
  const switchToTerminal = useViewerStore((s) => s.switchToTerminal);
  const [preferredEditor, setPreferredEditor] = useState<ExternalEditor>(() => {
    if (typeof window === 'undefined') return 'vscode';
    const saved = window.localStorage.getItem(OPEN_EDITOR_PREF_KEY);
    return isExternalEditor(saved) ? saved : 'vscode';
  });
  const [openingEditor, setOpeningEditor] = useState<ExternalEditor | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OPEN_EDITOR_PREF_KEY, preferredEditor);
  }, [preferredEditor]);

  if (!currentDirectory) return null;
  const directory = currentDirectory;

  const canOpenInEditor = isLocal && sandboxStatus === 'running';
  const canOpenOpencode = sandboxStatus === 'running';
  const canOpenTerminal = isLocal && sandboxStatus === 'running';
  const isOpencodeActive = viewerMode === 'opencode';
  const isTerminalActive = viewerMode === 'terminal';
  const openCodeUnavailableHint = isLocal
    ? t('layout.open_requires_running')
    : t('layout.open_requires_remote_connected');

  async function handleOpenInEditor(editor: ExternalEditor) {
    if (!canOpenInEditor) return;

    setOpeningEditor(editor);
    try {
      const result = await openProjectInEditor(editor, directory);
      toast.success(
        t('layout.open_in_success').replace('{editor}', result.editorLabel),
      );
    } catch (error) {
      const description =
        error instanceof Error ? error.message : String(error);
      toast.error(t('layout.open_in_failed'), { description });
    } finally {
      setOpeningEditor(null);
    }
  }

  function handleOpenTerminal() {
    if (!canOpenTerminal) return;
    switchToTerminal();
  }

  return (
    <>
      {isLocal && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('layout.open_external')}
              className="h-7 gap-1 px-2 text-xs"
            >
              <img
                src={getEditorLogo(preferredEditor)}
                alt=""
                aria-hidden
                className="h-3.5 w-3.5 shrink-0"
              />
              <span>{t('layout.open_external')}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[180px]">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {t('layout.open_menu_label')}
            </div>
            <DropdownMenuItem
              onSelect={() => {
                setPreferredEditor('vscode');
                void handleOpenInEditor('vscode');
              }}
              disabled={!canOpenInEditor || openingEditor !== null}
              className="text-xs"
            >
              {openingEditor === 'vscode' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : preferredEditor === 'vscode' ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <span aria-hidden className="h-3.5 w-3.5" />
              )}
              <img
                src={vscodeLogo}
                alt=""
                aria-hidden
                className="h-3.5 w-3.5 shrink-0"
              />
              {t('layout.open_in_vscode')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setPreferredEditor('cursor');
                void handleOpenInEditor('cursor');
              }}
              disabled={!canOpenInEditor || openingEditor !== null}
              className="text-xs"
            >
              {openingEditor === 'cursor' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : preferredEditor === 'cursor' ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <span aria-hidden className="h-3.5 w-3.5" />
              )}
              <img
                src={cursorLogo}
                alt=""
                aria-hidden
                className="h-3.5 w-3.5 shrink-0"
              />
              {t('layout.open_in_cursor')}
            </DropdownMenuItem>
            {!canOpenInEditor && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                {t('layout.open_requires_running')}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                aria-label={t('command.opencode')}
                onClick={switchToOpencode}
                disabled={!canOpenOpencode}
                className={cn(
                  'h-7 w-7 px-0 text-xs xl:w-auto xl:gap-1 xl:px-2',
                  isOpencodeActive &&
                    'border-primary/40 bg-accent text-accent-foreground',
                )}
              >
                <img
                  src={opencodeLogo}
                  alt=""
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span className="hidden xl:inline">{t('panel.opencode')}</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {canOpenOpencode
              ? t('panel.opencode')
              : openCodeUnavailableHint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isLocal && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t('command.terminal')}
                  onClick={handleOpenTerminal}
                  disabled={!canOpenTerminal}
                  className={cn(
                    'h-7 w-7 px-0 text-xs xl:w-auto xl:gap-1 xl:px-2',
                    isTerminalActive &&
                      'border-primary/40 bg-accent text-accent-foreground',
                  )}
                >
                  <TerminalSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden xl:inline">{t('panel.terminal')}</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {canOpenTerminal
                ? t('panel.terminal')
                : t('layout.open_requires_running')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}
