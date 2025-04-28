import { Module, Provider, ValidationPipe } from '@nestjs/common';
import { JobsController } from './controller/jobs.controller';
import { JobsService } from './service/jobs.service';
import { JobsNormalRepository } from './repository/jobs.normal.repository';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsBatch } from './batch/jobs.batch';
import { Config, JsonDB } from 'node-json-db';
import { JobsCacheRepository } from './repository/jobs.cache.repository';
import { JobsIRepository } from './repository/jobs.interface.repository';

const db: JsonDB = new JsonDB(new Config('jobs', true, true));

const jobsRepository: Provider<JobsIRepository> = {
  provide: 'JOBS_REPOSITORY',
  useClass: process.env.NODE_ENV === 'cache' ? JobsCacheRepository : JobsNormalRepository,
};

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [JobsController],
  providers: [
    JobsBatch,
    JobsService,
    jobsRepository,
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
