import { Module, Provider } from '@nestjs/common';
import { JobsController } from './controller/jobs.controller';
import { JobsService } from './service/jobs.service';
import { JobsNormalRepository } from './repository/jobs.normal.repository';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsBatch } from './batch/jobs.batch';
import { Config, JsonDB } from 'node-json-db';
import { JobsCacheRepository } from './repository/jobs.cache.repository';
import { JobsIRepository } from './repository/jobs.interface.repository';
import { jobsValidationPipe } from './config/jobs.pipe';

const jobsRepository: Provider<JobsIRepository> = {
  provide: 'JOBS_REPOSITORY',
  useFactory: () => {
    if (process.env.NODE_ENV === 'cache') {
      const db: JsonDB = new JsonDB(new Config('jobs', false, false));
      const cacheDb: JsonDB = new JsonDB(new Config('cache_buffer_jobs', true, false));
      return new JobsCacheRepository(db, cacheDb);
    }

    return new JobsNormalRepository(new JsonDB(new Config('jobs', true, false)));
  }
};

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [JobsController],
  providers: [
    JobsBatch,
    JobsService,
    jobsRepository,
    {
      provide: APP_PIPE,
      useValue: jobsValidationPipe,
    },
  ],
})
export class JobsModule {}
