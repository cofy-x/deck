/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

export interface ExampleJobData {
  dbId: number;
  content: string;
}

export interface ExampleJobResult {
  processed: boolean;
  timestamp: number;
}

@Processor('example-queue')
export class ExampleProcessor extends WorkerHost {
  private readonly logger = new Logger(ExampleProcessor.name);

  async process(
    job: Job<ExampleJobData, ExampleJobResult, string>,
  ): Promise<ExampleJobResult> {
    this.logger.log(
      `[BullMQ] Processing Job ID: ${job.id}, DB ID: ${job.data.dbId}, Content: ${job.data.content}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.logger.log(`[BullMQ] Job Finished: ${job.id}`);

    return {
      processed: true,
      timestamp: Date.now(),
    };
  }
}
