import { Module, ValidationPipe } from '@nestjs/common';
import { JobsRepository } from './dao/jobs.repository';
import { APP_PIPE } from '@nestjs/core';

@Module({
  providers: [
    JobsRepository,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class JobsModule {}
