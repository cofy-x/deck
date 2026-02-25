/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, rm } from 'node:fs/promises';
import type { JsonObject } from '../../types/index.js';
import { ApiError } from '../../errors.js';
import {
  writeJsoncFile,
  updateJsoncTopLevel,
} from '../../utils/jsonc.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import {
  opencodeConfigPath,
  projectCommandsDir,
  projectSkillsDir,
} from '../../utils/workspace-files.js';
import { listCommands, upsertCommand } from '../command.service.js';
import { listSkills, upsertSkill } from '../skill.service.js';
import type { WorkspaceInfo } from '../../types/index.js';
import {
  readOpencodeConfig,
  readPilotConfig,
  writePilotConfig,
} from './workspace-config-repository.js';

interface ImportModes {
  opencode?: string;
  pilot?: string;
  skills?: string;
  commands?: string;
}

interface ImportSkillPayload {
  name: string;
  content: string;
  description?: string;
}

interface ImportCommandPayload {
  name?: string;
  content?: string;
  description?: string;
  template?: string;
  agent?: string;
  model?: string | null;
  subtask?: boolean;
}

export async function exportWorkspace(workspace: WorkspaceInfo) {
  const opencode = await readOpencodeConfig(workspace.path);
  const pilot = await readPilotConfig(workspace.path);
  const skills = await listSkills(workspace.path, false);
  const commands = await listCommands(workspace.path, 'workspace');
  const skillContents = await Promise.all(
    skills.map(async (skill) => ({
      name: skill.name,
      description: skill.description,
      content: await readFile(skill.path, 'utf8'),
    })),
  );
  const commandContents = await Promise.all(
    commands.map(async (command) => ({
      name: command.name,
      description: command.description,
      template: command.template,
    })),
  );

  return {
    workspaceId: workspace.id,
    exportedAt: Date.now(),
    opencode,
    pilot,
    skills: skillContents,
    commands: commandContents,
  };
}

export async function importWorkspace(
  workspace: WorkspaceInfo,
  payload: Record<string, unknown>,
): Promise<void> {
  const modes = (payload['mode'] as ImportModes | undefined) ?? {};
  const opencode = payload['opencode'] as JsonObject | undefined;
  const pilot = payload['pilot'] as JsonObject | undefined;
  const skills = (payload['skills'] as ImportSkillPayload[] | undefined) ?? [];
  const commands =
    (payload['commands'] as ImportCommandPayload[] | undefined) ?? [];

  if (opencode) {
    if (modes.opencode === 'replace') {
      await writeJsoncFile(opencodeConfigPath(workspace.path), opencode);
    } else {
      await updateJsoncTopLevel(opencodeConfigPath(workspace.path), opencode);
    }
  }

  if (pilot) {
    if (modes.pilot === 'replace') {
      await writePilotConfig(workspace.path, pilot, false);
    } else {
      await writePilotConfig(workspace.path, pilot, true);
    }
  }

  if (skills.length > 0) {
    if (modes.skills === 'replace') {
      await rm(projectSkillsDir(workspace.path), {
        recursive: true,
        force: true,
      });
    }
    for (const skill of skills) {
      await upsertSkill(workspace.path, skill);
    }
  }

  if (commands.length > 0) {
    if (modes.commands === 'replace') {
      await rm(projectCommandsDir(workspace.path), {
        recursive: true,
        force: true,
      });
    }
    for (const command of commands) {
      if (command.content) {
        const parsed = parseFrontmatter(command.content);
        const name =
          command.name ||
          (typeof parsed.data['name'] === 'string' ? parsed.data['name'] : '');
        const description =
          command.description ||
          (typeof parsed.data['description'] === 'string'
            ? parsed.data['description']
            : undefined);
        if (!name) {
          throw new ApiError(
            400,
            'invalid_command',
            'Command name is required',
          );
        }
        const template = parsed.body.trim();
        const commandPayload = {
          name,
          template,
          description,
          agent:
            typeof parsed.data['agent'] === 'string'
              ? parsed.data['agent']
              : undefined,
          model:
            typeof parsed.data['model'] === 'string'
              ? parsed.data['model']
              : undefined,
          subtask:
            typeof parsed.data['subtask'] === 'boolean'
              ? parsed.data['subtask']
              : undefined,
        };
        await upsertCommand(workspace.path, commandPayload);
      } else {
        const commandPayload = {
          name: command.name ?? '',
          template: command.template ?? '',
          description: command.description,
          agent: command.agent,
          model: command.model,
          subtask: command.subtask,
        };
        await upsertCommand(workspace.path, commandPayload);
      }
    }
  }
}
