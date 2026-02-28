/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ComponentType } from 'react';
import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  MessageSquare,
  Play,
  Settings,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';

async function openLogDirectory() {
  try {
    const logDir = await invoke<string>('get_app_log_dir');
    await revealItemInDir(logDir);
  } catch (err) {
    console.error('[chat-welcome] Failed to open log directory:', err);
  }
}

interface WelcomePrimaryAction {
  label: string;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
}

interface WelcomeErrorContent {
  title: string;
  message: string;
  connectionText: string | null;
  hint: string | null;
}

export interface ChatWelcomeProps {
  isRemote: boolean;
  isError: boolean;
  isRemoteAuthError: boolean;
  connectionName: string;
  errorMessage: string | null;
  isStarting: boolean;
  startDisabled: boolean;
  onStart: () => void;
  onOpenSettings: () => void;
}

function resolveWelcomePrimaryAction(input: {
  isRemote: boolean;
  isError: boolean;
  isRemoteAuthError: boolean;
  onStart: () => void;
  onOpenSettings: () => void;
}): WelcomePrimaryAction {
  const { isRemote, isError, isRemoteAuthError, onStart, onOpenSettings } =
    input;

  if (isRemoteAuthError) {
    return {
      label: t('layout.open_settings'),
      onClick: onOpenSettings,
      icon: Settings,
    };
  }

  if (isError) {
    return {
      label: isRemote ? t('sandbox.retry_connection') : t('common.retry'),
      onClick: onStart,
      icon: Play,
    };
  }

  return {
    label: isRemote ? t('sandbox.connect_remote') : t('sandbox.start_sandbox'),
    onClick: onStart,
    icon: Play,
  };
}

function resolveWelcomeErrorContent(input: {
  isRemote: boolean;
  isRemoteAuthError: boolean;
  connectionName: string;
  errorMessage: string | null;
}): WelcomeErrorContent {
  const { isRemote, isRemoteAuthError, connectionName, errorMessage } = input;
  return {
    title: isRemote ? t('sandbox.remote_error') : t('sandbox.sandbox_error'),
    message: errorMessage ?? t('sandbox.unknown_error'),
    connectionText: isRemote
      ? t('chat.welcome_connection').replace('{name}', connectionName)
      : null,
    hint: isRemoteAuthError ? t('chat.welcome_auth_error_hint') : null,
  };
}

export function ChatWelcome({
  isRemote,
  isError,
  isRemoteAuthError,
  connectionName,
  errorMessage,
  isStarting,
  startDisabled,
  onStart,
  onOpenSettings,
}: ChatWelcomeProps) {
  const primaryAction = resolveWelcomePrimaryAction({
    isRemote,
    isError,
    isRemoteAuthError,
    onStart,
    onOpenSettings,
  });
  const errorContent = isError
    ? resolveWelcomeErrorContent({
        isRemote,
        isRemoteAuthError,
        connectionName,
        errorMessage,
      })
    : null;

  const PrimaryIcon = primaryAction.icon;

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      <MessageSquare className="h-10 w-10" />
      <h3 className="text-base font-medium text-foreground">
        {t('chat.welcome_title')}
      </h3>
      <p className="max-w-xs text-sm">
        {t('chat.welcome_description')}
      </p>

      {errorContent && (
        <div className="w-full max-w-md rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-left text-destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {errorContent.title}
              </p>
              {errorContent.connectionText && (
                <p className="text-xs opacity-80">
                  {errorContent.connectionText}
                </p>
              )}
              <p className="wrap-break-word text-xs">
                {errorContent.message}
              </p>
              {errorContent.hint && (
                <p className="mt-1 text-xs font-medium">
                  {errorContent.hint}
                </p>
              )}
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 text-xs underline opacity-70 hover:opacity-100"
                onClick={() => void openLogDirectory()}
              >
                <FolderOpen className="h-3 w-3" />
                {t('sandbox.open_log_dir')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={primaryAction.onClick}
        disabled={isStarting || startDisabled}
        className="mt-2"
      >
        {isStarting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PrimaryIcon className="mr-2 h-4 w-4" />
        )}
        {primaryAction.label}
      </Button>
      {isRemoteAuthError && (
        <Button
          variant="outline"
          onClick={onStart}
          className="mt-1"
        >
          {t('sandbox.retry_connection')}
        </Button>
      )}
    </div>
  );
}
