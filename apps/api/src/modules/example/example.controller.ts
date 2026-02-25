/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */ import {
  Controller,
  Post,
  Body,
  Get,
  Inject,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { interval, map, Observable } from 'rxjs';
import {
  DB_CONNECTION,
  type DrizzleDB,
} from '../../common/database/database.module.js';
import { examples } from '../../common/database/schema.js';
import { CreateExampleDto } from './example.dto.js';
import {
  type ExampleJobData,
  type ExampleJobResult,
} from './example.processor.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

interface StreamPayload {
  hello: string;
  time: string;
}

@ApiTags('Example')
@Controller('example')
export class ExampleController {
  constructor(
    @Inject(DB_CONNECTION) private db: DrizzleDB,
    @InjectQueue('example-queue')
    private exampleQueue: Queue<ExampleJobData, ExampleJobResult, string>,
  ) {}

  @ApiOperation({ summary: 'Create an example' })
  @Post('create')
  async create(@Body() body: CreateExampleDto) {
    const [result] = await this.db
      .insert(examples)
      .values({ message: body.message })
      .returning();

    await this.exampleQueue.add('test-job', {
      dbId: result.id,
      content: body.message,
    });

    return {
      success: true,
      db_record: result,
      queue_message: 'Job added to queue',
    };
  }

  @Get('list')
  async list() {
    return this.db.select().from(examples);
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map(
        (num: number): MessageEvent => ({
          data: {
            hello: 'world',
            time: new Date().toISOString(),
            tick: num,
          } as StreamPayload,
          type: 'ping',
        }),
      ),
    );
  }
}
