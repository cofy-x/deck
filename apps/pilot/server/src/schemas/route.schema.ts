/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { jsonObjectSchema, nonEmptyStringSchema } from './common.js';

const importModeSchema = z.enum(['merge', 'replace']);

export const workspaceIdParamsSchema = z.object({
  id: nonEmptyStringSchema,
});

export const workspaceNameParamsSchema = z.object({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
});

export const approvalIdParamsSchema = z.object({
  id: nonEmptyStringSchema,
});

export const includeGlobalQuerySchema = z.object({
  includeGlobal: z.enum(['true', 'false']).optional(),
});

export const scopeQuerySchema = z.object({
  scope: z.enum(['workspace', 'global']).optional(),
});

export const auditQuerySchema = z.object({
  limit: z.string().optional(),
});

export const eventsQuerySchema = z.object({
  since: z.string().optional(),
});

export const patchConfigBodySchema = z
  .object({
    opencode: jsonObjectSchema.optional(),
    pilot: jsonObjectSchema.optional(),
  })
  .refine((value) => Boolean(value.opencode || value.pilot), {
    message: 'opencode or pilot updates required',
  });

export const importConfigBodySchema = z
  .object({
    mode: z
      .object({
        opencode: importModeSchema.optional(),
        pilot: importModeSchema.optional(),
        skills: importModeSchema.optional(),
        commands: importModeSchema.optional(),
      })
      .optional(),
    opencode: jsonObjectSchema.optional(),
    pilot: jsonObjectSchema.optional(),
    skills: z
      .array(
        z.object({
          name: nonEmptyStringSchema,
          content: z.string(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    commands: z
      .array(
        z.object({
          name: z.string().optional(),
          content: z.string().optional(),
          description: z.string().optional(),
          template: z.string().optional(),
          agent: z.string().optional(),
          model: z.string().nullable().optional(),
          subtask: z.boolean().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

export const addPluginBodySchema = z.object({
  spec: z.string(),
});

export const addMcpBodySchema = z.object({
  name: z.string(),
  config: jsonObjectSchema,
});

export const upsertSkillBodySchema = z.object({
  name: z.string(),
  content: z.string(),
  description: z.string().optional(),
});

export const upsertCommandBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  template: z.string(),
  agent: z.string().optional(),
  model: z.string().nullable().optional(),
  subtask: z.boolean().optional(),
});

export const bridgeTelegramBodySchema = z.object({
  token: z.string(),
  healthPort: z.number().int().positive().max(65535).optional(),
});

export const bridgeSlackBodySchema = z.object({
  botToken: z.string(),
  appToken: z.string(),
  healthPort: z.number().int().positive().max(65535).optional(),
});

export const approvalReplyBodySchema = z.object({
  reply: z.enum(['allow', 'deny']),
});

export type PatchConfigBody = z.infer<typeof patchConfigBodySchema>;
export type ImportConfigBody = z.infer<typeof importConfigBodySchema>;
export type AddPluginBody = z.infer<typeof addPluginBodySchema>;
export type AddMcpBody = z.infer<typeof addMcpBodySchema>;
export type UpsertSkillBody = z.infer<typeof upsertSkillBodySchema>;
export type UpsertCommandBody = z.infer<typeof upsertCommandBodySchema>;
export type BridgeTelegramBody = z.infer<typeof bridgeTelegramBodySchema>;
export type BridgeSlackBody = z.infer<typeof bridgeSlackBodySchema>;
