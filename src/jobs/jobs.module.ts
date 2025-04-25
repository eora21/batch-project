import { Module, ValidationPipe } from '@nestjs/common';
import { JobsController } from './controller/jobs.controller';
import { JobsService } from './service/jobs.service';
import { JobsRepository } from './dao/jobs.repository';
import { APP_PIPE } from '@nestjs/core';

@Module({
  controllers: [JobsController],
  providers: [
    JobsService, JobsRepository,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class JobsModule {}
