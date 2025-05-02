import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from '../service/jobs.service';
import { INestApplication } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { jobsValidationPipe } from '../config/jobs.pipe';
import * as request from 'supertest';
import { JobsInsertRequestDto } from '../dto/jobs.insert.request.dto';
import { Job } from '../model/job.entity';

describe(`jobsController`, () => {
  let app: INestApplication;
  let mockJobsService: any;

  beforeAll(async () => {
    mockJobsService = {
      add: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      search: jest.fn(),
      updatePendingJobToCompleteJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
        {
          provide: APP_PIPE,
          useValue: jobsValidationPipe,
        }
      ],
    }).compile();

    app = module.createNestApplication();

    await app.init();
  });

  afterAll(() => {
    app.close();
  });

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  describe('job 생성 시', () => {
    let jobsInsertRequestDto: JobsInsertRequestDto;

    beforeEach(() => {
      jobsInsertRequestDto = new JobsInsertRequestDto();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('제목이 누락된 경우 실패해야 한다', async () => {
      // given
      jobsInsertRequestDto.description = '내용';

      // when
      const response = await request(app.getHttpServer())
        .post('/jobs')
        .send(jobsInsertRequestDto);

      // then
      expect(response.status).toBe(400);
    });

    it('내용이 누락된 경우 실패해야 한다', async () => {
      // given
      jobsInsertRequestDto.title = '제목';

      // when
      const response = await request(app.getHttpServer())
        .post('/jobs')
        .send(jobsInsertRequestDto);

      // then
      expect(response.status).toBe(400);
    });

    it('제목과 내용이 존재하는 경우 성공해야 한다', async () => {
      // given
      const title = '제목';
      const description = '내용';

      jobsInsertRequestDto.title = title;
      jobsInsertRequestDto.description = description;

      const job = new Job(title, description);
      mockJobsService.add.mockResolvedValue(job);

      // when
      const response = await request(app.getHttpServer())
        .post('/jobs')
        .send(jobsInsertRequestDto);

      // then
      expect(response.status).toBe(201);
      expect(response.body).toEqual(job);
    });

    it('제목은 trim이 수행되어야 한다', async () => {
      // given
      const title = '   제목   ';
      const description = '내용';

      jobsInsertRequestDto.title = title;
      jobsInsertRequestDto.description = description;

      const job = new Job(title.trim(), description);
      mockJobsService.add.mockResolvedValue(job);

      // when
      const response = await request(app.getHttpServer())
        .post('/jobs')
        .send(jobsInsertRequestDto);

      // then
      expect(response.status).toBe(201);
      expect(response.body).toEqual(job);
    });
  });

  describe('id로 job 검색 시', () => {

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('존재하지 않는다면 실패해야 한다', async () => {
      // given

      // when
      const response = await request(app.getHttpServer())
        .get('/jobs/not-found');

      // then
      expect(response.status).toBe(404);
    });

    it('존재한다면 성공해야 한다', async () => {
      // given
      mockJobsService.get.mockResolvedValue(new Job('제목', '내용'));

      // when
      const response = await request(app.getHttpServer())
        .get('/jobs/exist');

      // then
      expect(response.status).toBe(200);
    });
  });

  describe('title, status로 job 검색 시', () => {

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('존재하지 않는 status라면 실패해야 한다', async () => {
      // given

      // when
      const response = await request(app.getHttpServer())
        .get('/jobs/search?status=wrong');

      // then
      expect(response.status).toBe(400);
    });
  });
});
