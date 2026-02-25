/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateExampleSchema = z.object({
  message: z.string().min(1).describe('Test Message'),
});

export class CreateExampleDto extends createZodDto(CreateExampleSchema) {}
