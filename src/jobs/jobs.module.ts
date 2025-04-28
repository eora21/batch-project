import { Module, ValidationPipe } from '@nestjs/common';
import { JobsController } from './controller/jobs.controller';
import { JobsService } from './service/jobs.service';
import { JobsRepository } from './repository/jobs.repository';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsBatch } from './batch/jobs.batch';
import { Config, JsonDB } from 'node-json-db';

const db: JsonDB = new JsonDB(new Config('jobs', true, true));

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [JobsController],
  providers: [
    JobsBatch,
    JobsService,
    JobsRepository,
    {
      provide: JsonDB,
      useValue: db,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class JobsModule {}
