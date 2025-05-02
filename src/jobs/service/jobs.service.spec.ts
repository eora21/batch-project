import { ConfigWithAdapter, FileAdapter, JsonAdapter, JsonDB } from 'node-json-db';
import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { JobStatus } from '../model/job.status';
import { JobsCacheRepository } from '../repository/jobs.cache.repository';

class NotWriteFileAdapter extends FileAdapter {

  writeAsync(data: any): Promise<void> {
    return Promise.resolve(undefined);
  }
}

describe('jobsService', () => {
  let service: JobsService;

  beforeAll(async () => {
    const db = new JsonDB(new ConfigWithAdapter(new JsonAdapter(new NotWriteFileAdapter('jobs_700000.json', false)), false));
    const cacheBufferDb = new JsonDB(new ConfigWithAdapter(new JsonAdapter(new NotWriteFileAdapter('jobs_cache_buffer.json', false)), false));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: 'JOBS_REPOSITORY',
          // useValue: new JobsNormalRepository(db),
          useValue: new JobsCacheRepository(db, cacheBufferDb),
        },
      ],
    }).compile();

    await module.init();

    service = module.get<JobsService>(JobsService);

    await db.load();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('추가', async () => {
    // given
    const startTime = performance.now();

    // when
    await service.add('제목', '내용');

    // then
    const endTime = performance.now();
    console.log(`${ endTime - startTime } ms`);
  });

  it('id로 조회', async () => {
    // given
    const startTime = performance.now();

    // when
    await service.get('019680b4-b5d0-72e6-ba10-45ac80635f5e'); // 해당 파일의 가장 마지막 id

    // then
    const endTime = performance.now();
    console.log(`${ endTime - startTime } ms`);
  });

  it('모든 데이터 조회', async () => {
    // given
    const startTime = performance.now();

    // when
    await service.getAll();

    // then
    const endTime = performance.now();
    console.log(`${ endTime - startTime } ms`);
  });

  it('title로 검색', async () => {
    // given
    const startTime = performance.now();

    // when
    await service.search('"제목 99');

    // then
    const endTime = performance.now();
    console.log(`${ endTime - startTime } ms`);
  });

  it('status로 검색', async () => {
    // given
    const startTime = performance.now();

    // when
    await service.search(undefined, JobStatus.PENDING);

    // then
    const endTime = performance.now();
    console.log(`${ endTime - startTime } ms`);
  });

  it('title, status로 검색', async () => {
    // given
    const startTime = performance.now();

    // when
    await service.search('제목 99', JobStatus.PENDING);

    // then
    const endTime = performance.now();
    console.log(`${ endTime - startTime } ms`);
  });

  it('pending -> completed로 status 업데이트', async () => {
    // given
    const startTime = performance.now();

    // when
    await service.updatePendingJobToCompleteJob();

    // then
    const endTime = performance.now();
    console.log(`${ endTime - startTime } ms`);
  });
});

