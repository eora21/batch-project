import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JobsIRepository } from '../../src/jobs/repository/jobs.interface.repository';
import { Config, JsonDB } from 'node-json-db';
import { APP_PIPE } from '@nestjs/core';
import { JobsNormalRepository } from '../../src/jobs/repository/jobs.normal.repository';
import { Job } from '../../src/jobs/model/job.entity';
import { JobStatus } from '../../src/jobs/model/job.status';

const fileCount = 700_000;
const db: JsonDB = new JsonDB(new Config(`jobs_${ fileCount }`, false, false));

describe('jobs', () => {
  let repository: JobsIRepository;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'JOBS_REPOSITORY',
          useClass: JobsNormalRepository,
        },
        {
          provide: JsonDB,
          useValue: db,
        },
        {
          provide: APP_PIPE,
          useValue: new ValidationPipe({
            transform: true,
          }),
        },
      ],
    }).compile();

    repository = module.get<JobsIRepository>('JOBS_REPOSITORY');
  });

  it('테스트 데이터 생성', async () => {
    const promises = [];

    for (let i = 0; i < fileCount; i++) {
      const job = new Job(`제목 ${ i % 100 }`, '설명');

      if (i < fileCount / 2) {
        job.status = JobStatus.COMPLETED;
      }

      promises.push(repository.save(job));
    }

    try {
      await Promise.all(promises);
      await db.save();
    } catch (error) {
      console.error(error);
    }
  }, fileCount);
});
