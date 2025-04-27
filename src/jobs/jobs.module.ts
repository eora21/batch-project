import { Module, ValidationPipe } from '@nestjs/common';
import { JobsController } from './controller/jobs.controller';
import { JobsService } from './service/jobs.service';
import { JobsRepository } from './dao/jobs.repository';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsBatch } from './batch/jobs.batch';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [JobsController],
  providers: [
    JobsBatch,
    JobsService,
    JobsRepository,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class JobsModule {}
