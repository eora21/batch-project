import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from '../model/job.entity';
import { JsonDB } from 'node-json-db';
import { JobStatus } from '../model/job.status';
import { JobsIRepository } from './jobs.interface.repository';
import { JobsResponseDto } from '../dto/jobs.response.dto';

@Injectable()
export class JobsCacheRepository implements JobsIRepository, OnModuleInit {
  private readonly statusJobs: Map<JobStatus, Job[]> = new Map();
  private readonly idJobs: Map<string, Job> = new Map();
  private readonly titleJobs: Map<string, Job[]> = new Map();

  constructor(private readonly db: JsonDB, private readonly cacheBufferDb: JsonDB) {
  }

  async onModuleInit(): Promise<void> {
    Object.values(JobStatus)
      .forEach(status => this.statusJobs.set(status, []));

    if (await this.db.exists('/jobs')) {
      const jobs = await this.db.getObject<Job[]>('/jobs');

      jobs.forEach((job: Job) =>
        this.cacheJob(job)
      );
    }

    if (await this.cacheBufferDb.exists('/jobs')) {
      const bufferedPendingJobs = await this.cacheBufferDb.getObject<Job[]>('/jobs');
      bufferedPendingJobs.forEach((job: Job) => this.addStatusJob(job));
    }
  }

  async save(job: Job): Promise<JobsResponseDto> {
    await this.addBuffer(job);
    await this.db.push('/jobs[]', job);
    this.cacheJob(job);
    return new JobsResponseDto(job);
  }

  private async addBuffer(job: Job) {
    await this.cacheBufferDb.push('/jobs[]', job);
  }

  private cacheJob(job: Job) {
    this.addStatusJob(job);
    this.putIdJob(job);
    this.addTitleJob(job);
  }

  private addStatusJob(job: Job) {
    this.statusJobs.get(job.status)
      .push(job);
  }

  private putIdJob(job: Job) {
    this.idJobs.set(job.id, job);
  }

  private addTitleJob(job: Job) {
    let titleJobs = this.titleJobs.get(job.title);

    if (titleJobs === undefined) {
      titleJobs = [];
      this.titleJobs.set(job.title, titleJobs);
    }

    titleJobs.push(job);
  }

  async findById(id: string) {
    const job = this.idJobs.get(id);

    if (job === undefined) {
      return undefined;
    }

    return new JobsResponseDto(job);
  }

  async findAll() {
    return (await this.db.getObject<Job[]>('/jobs'))
      .map(job => new JobsResponseDto(job));
  }

  async findByParams(title?: string, status?: JobStatus): Promise<Job[]> {

    if (title === undefined && status === undefined) {
      return [];
    }

    if (title === undefined) {
      return this.statusJobs.get(status)
        .map(job => new JobsResponseDto(job));
    }

    if (status === undefined) {
      return this.getTitleJobs(title)
        .map(job => new JobsResponseDto(job));
    }

    const titleJobs = this.getTitleJobs(title);
    const statusJobs = this.statusJobs.get(status);

    if (titleJobs.length <= statusJobs.length) {
      return titleJobs.filter(job => job.status === status)
        .map(job => new JobsResponseDto(job));
    }

    return statusJobs.filter(job => job.title === title)
      .map(job => new JobsResponseDto(job));
  }

  private getTitleJobs(title: string): Job[] {
    return this.titleJobs.get(title) ?? [];
  }

  async completePendingJobs(): Promise<number> {
    const pendingJobs = this.statusJobs.get(JobStatus.PENDING);
    const pendingStatusJobsCount = pendingJobs.length;
    const completedJobs = this.statusJobs.get(JobStatus.COMPLETED);

    pendingJobs.forEach((job: Job) => job.status = JobStatus.COMPLETED);
    this.statusJobs.set(JobStatus.COMPLETED, pendingJobs.concat(completedJobs));

    pendingJobs.length = 0;

    await this.db.save();
    await this.cacheBufferDb.delete('/jobs');

    return pendingStatusJobsCount;
  }
}
