/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { invoke } from '@tauri-apps/api/core';

import { isTauriRuntime } from './utils';

export type ExternalEditor = 'vscode' | 'cursor';

export interface OpenProjectInEditorResult {
  editor: string;
  editorLabel: string;
  hostAlias: string;
  command: string;
}

export async function openProjectInEditor(
  editor: ExternalEditor,
  directory: string,
): Promise<OpenProjectInEditorResult> {
  if (!isTauriRuntime()) {
    throw new Error('This action is available only in the desktop app.');
  }

  return invoke<OpenProjectInEditorResult>('open_project_in_editor', {
    input: {
      editor,
      directory,
    },
  });
}

