/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExampleController } from './example.controller.js';
import { ExampleProcessor } from './example.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'example-queue',
    }),
  ],
  controllers: [ExampleController],
  providers: [ExampleProcessor],
})
export class ExampleModule {}
