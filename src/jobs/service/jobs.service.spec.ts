import { JobsService } from './jobs.service';
import { Test, TestingModule } from '@nestjs/testing';
import { JobsRepository } from '../dao/jobs.repository';

const mockJobsRepository = {};

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: JobsRepository,
          useValue: mockJobsRepository,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('아무런 쿼리 파라미터가 전달되지 않았을 경우, 빈 배열을 반환해야 한다', async () => {
    const result = await service.search(undefined, undefined);
    expect(result).toHaveLength(0);
  });
});
