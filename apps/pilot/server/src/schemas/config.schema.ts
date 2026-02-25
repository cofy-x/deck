/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { nonEmptyStringSchema } from './common.js';

export const approvalModeSchema = z.enum(['manual', 'auto']);

export const logFormatSchema = z.enum(['pretty', 'json']);

export const workspaceConfigSchema = z.object({
  id: nonEmptyStringSchema.optional(),
  path: nonEmptyStringSchema,
  name: nonEmptyStringSchema.optional(),
  workspaceType: z.enum(['local', 'remote']).optional(),
  baseUrl: nonEmptyStringSchema.optional(),
  directory: nonEmptyStringSchema.optional(),
  opencodeUsername: nonEmptyStringSchema.optional(),
  opencodePassword: nonEmptyStringSchema.optional(),
});

export const resolvedWorkspaceConfigSchema = z.discriminatedUnion(
  'workspaceType',
  [
    z.object({
      id: nonEmptyStringSchema.optional(),
      path: nonEmptyStringSchema,
      name: nonEmptyStringSchema.optional(),
      workspaceType: z.literal('local'),
      baseUrl: nonEmptyStringSchema.optional(),
      directory: nonEmptyStringSchema.optional(),
      opencodeUsername: nonEmptyStringSchema.optional(),
      opencodePassword: nonEmptyStringSchema.optional(),
    }),
    z.object({
      id: nonEmptyStringSchema.optional(),
      path: nonEmptyStringSchema,
      name: nonEmptyStringSchema.optional(),
      workspaceType: z.literal('remote'),
      baseUrl: nonEmptyStringSchema,
      directory: nonEmptyStringSchema,
      opencodeUsername: nonEmptyStringSchema.optional(),
      opencodePassword: nonEmptyStringSchema.optional(),
    }),
  ],
);

export const approvalConfigSchema = z.object({
  mode: approvalModeSchema,
  timeoutMs: z.number().int().positive(),
});

export const fileConfigSchema = z
  .object({
    host: nonEmptyStringSchema.optional(),
    port: z.number().int().min(1).max(65535).optional(),
    token: nonEmptyStringSchema.optional(),
    hostToken: nonEmptyStringSchema.optional(),
    approval: approvalConfigSchema.partial().optional(),
    workspaces: z.array(workspaceConfigSchema).optional(),
    corsOrigins: z.array(nonEmptyStringSchema).optional(),
    authorizedRoots: z.array(nonEmptyStringSchema).optional(),
    readOnly: z.boolean().optional(),
    opencodeUsername: nonEmptyStringSchema.optional(),
    opencodePassword: nonEmptyStringSchema.optional(),
    logFormat: logFormatSchema.optional(),
    logRequests: z.boolean().optional(),
    maxBodyBytes: z.number().int().positive().optional(),
  })
  .passthrough();

export const cliArgsSchema = z.object({
  configPath: nonEmptyStringSchema.optional(),
  host: nonEmptyStringSchema.optional(),
  port: z.number().int().min(1).max(65535).optional(),
  token: nonEmptyStringSchema.optional(),
  hostToken: nonEmptyStringSchema.optional(),
  approvalMode: approvalModeSchema.optional(),
  approvalTimeoutMs: z.number().int().positive().optional(),
  opencodeUrl: nonEmptyStringSchema.optional(),
  opencodeDirectory: nonEmptyStringSchema.optional(),
  opencodeUsername: nonEmptyStringSchema.optional(),
  opencodePassword: nonEmptyStringSchema.optional(),
  workspaces: z.array(nonEmptyStringSchema),
  corsOrigins: z.array(nonEmptyStringSchema).optional(),
  readOnly: z.boolean().optional(),
  verbose: z.boolean().optional(),
  logFormat: logFormatSchema.optional(),
  logRequests: z.boolean().optional(),
  version: z.boolean().optional(),
  help: z.boolean().optional(),
});

export type ParsedFileConfig = z.infer<typeof fileConfigSchema>;
export type ParsedCliArgs = z.infer<typeof cliArgsSchema>;
export type ParsedResolvedWorkspaceConfig = z.infer<
  typeof resolvedWorkspaceConfigSchema
>;
