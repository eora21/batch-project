import { Test, TestingModule } from '@nestjs/testing';
import { JobsNormalRepository } from './jobs.normal.repository';
import { JobsCacheRepository } from './jobs.cache.repository';
import { ConfigWithAdapter, IAdapter, JsonDB } from 'node-json-db';
import { JobStatus } from '../model/job.status';
import { JobsIRepository } from './jobs.interface.repository';
import { Job } from '../model/job.entity';

const mockJobs = [
  {
    'id': '1',
    'title': '원하는 제목',
    'description': '내용',
    'status': JobStatus.COMPLETED
  },
  {
    'id': '2',
    'title': '원하는 제목',
    'description': '내용',
    'status': JobStatus.COMPLETED
  },
  {
    'id': '3',
    'title': '제목',
    'description': '내용',
    'status': JobStatus.COMPLETED
  },
  {
    'id': '4',
    'title': '제목',
    'description': '내용',
    'status': JobStatus.PENDING
  },
  {
    'id': '5',
    'title': '제목',
    'description': '내용',
    'status': JobStatus.PENDING
  }
];

class MemoryAdapter implements IAdapter<any> {
  private data: any = {};

  readAsync(): Promise<any> {
    return Promise.resolve(this.data);
  }

  writeAsync(data: any): Promise<void> {
    this.data = data;
    return Promise.resolve(undefined);
  }
}

const db = new JsonDB(new ConfigWithAdapter(new MemoryAdapter(), false));
const cacheDb = new JsonDB(new ConfigWithAdapter(new MemoryAdapter(), false));

const repositories = [() => new JobsNormalRepository(db), () => new JobsCacheRepository(db, cacheDb)];

function testRepositories(repositoryCallback: typeof repositories[number]) {

  describe(`${ repositoryCallback }`, () => {
    let repository: JobsIRepository;

    beforeEach(async () => {
      await db.push('jobs', {
        'jobs': structuredClone(mockJobs),
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: 'JOBS_REPOSITORY',
            useValue: repositoryCallback(),
          },
        ],
      }).compile();

      await module.init();

      repository = module.get<JobsIRepository>('JOBS_REPOSITORY');
    });

    afterEach(async () => {
      await db.delete('jobs');
      await cacheDb.delete('jobs');
    });

    it('should be defined', () => {
      expect(repository).toBeDefined();
    });

    it('특정 id로 job 획득', async () => {
      // given

      // when
      const job = await repository.findById('1');

      // then
      expect(job).toEqual({
        'id': '1',
        'title': '원하는 제목',
        'description': '내용',
        'status': JobStatus.COMPLETED
      });
    });

    it('존재하지 않는 id면 undefined', async () => {
      // given

      // when
      const job = await repository.findById('Absent');

      // then
      expect(job).toBeUndefined();
    });

    it('title로 검색', async () => {
      // given

      // when
      const jobs = await repository.findByParams('원하는 제목');

      // then
      expect(jobs).toEqual([
        {
          'id': '1',
          'title': '원하는 제목',
          'description': '내용',
          'status': JobStatus.COMPLETED
        },
        {
          'id': '2',
          'title': '원하는 제목',
          'description': '내용',
          'status': JobStatus.COMPLETED
        }
      ]);
    });

    it('존재하지 않는 title 검색 시 빈 배열이 나와야 한다', async () => {
      // given

      // when
      const job = await repository.findByParams('존재하지 않는 title');

      // then
      expect(job).toEqual([]);
    });

    it('status로 검색: pending', async () => {
      // given

      // when
      const jobs = await repository.findByParams(undefined, JobStatus.PENDING);

      // then
      expect(jobs).toEqual([
        {
          'id': '4',
          'title': '제목',
          'description': '내용',
          'status': JobStatus.PENDING
        },
        {
          'id': '5',
          'title': '제목',
          'description': '내용',
          'status': JobStatus.PENDING
        }
      ]);
    });

    it('status로 검색: completed', async () => {
      // given

      // when
      const jobs = await repository.findByParams(undefined, JobStatus.COMPLETED);

      // then
      expect(jobs).toEqual([
        {
          'id': '1',
          'title': '원하는 제목',
          'description': '내용',
          'status': JobStatus.COMPLETED
        },
        {
          'id': '2',
          'title': '원하는 제목',
          'description': '내용',
          'status': JobStatus.COMPLETED
        },
        {
          'id': '3',
          'title': '제목',
          'description': '내용',
          'status': JobStatus.COMPLETED
        }
      ]);
    });

    it('title, status로 검색 시 교집합 데이터가 반환되어야 한다', async () => {
      // given

      // when
      const jobs = await repository.findByParams('제목', JobStatus.COMPLETED);

      // then
      expect(jobs).toEqual([
        {
          'id': '3',
          'title': '제목',
          'description': '내용',
          'status': JobStatus.COMPLETED
        }
      ]);
    });

    it('검색 시 둘 다 undefined면 빈 배열이 반환되어야 한다', async () => {
      // given

      // when
      const job = await repository.findByParams();

      // then
      expect(job).toHaveLength(0);
    });

    it('저장 시 id, title, status로 이를 확인할 수 있어야 한다', async () => {
      // given

      // when
      const job = await repository.save(new Job('새로운 job', '테스트용'));

      // then
      expect(await repository.findById(job.id)).toEqual(job);
      expect((await repository.findByParams(job.title)).at(-1)).toEqual(job);
      expect((await repository.findByParams(undefined, job.status)).at(-1)).toEqual(job);
      expect((await repository.findByParams(job.title, job.status)).at(-1)).toEqual(job);
    });

    it('모든 Job 찾기', async () => {
      // given

      // when
      const jobs = await repository.findAll();

      // then
      expect(jobs).toEqual(mockJobs);
    });

    it('status 업데이트 시 기존 status에 해당하는 job들은 새로운 status로 변경되어야 한다', async () => {
      // given
      const pendingLength = (await repository.findByParams(undefined, JobStatus.PENDING)).length;

      // when
      const updateCount = await repository.completePendingJobs();

      // then
      expect(updateCount).toBe(pendingLength);
      expect((await repository.findByParams(undefined, JobStatus.PENDING))).toHaveLength(0);
      expect((await repository.findByParams(undefined, JobStatus.COMPLETED))).toHaveLength(mockJobs.length);
    });
  });
}

repositories.forEach(repository => testRepositories(repository));
