import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from '../model/job.entity';
import { JsonDB } from 'node-json-db';
import { JobStatus } from '../model/job.status';
import { JobsIRepository } from './jobs.interface.repository';

@Injectable()
export class JobsCacheRepository implements JobsIRepository, OnModuleInit {
  private readonly statusJobs: Map<JobStatus, Job[]> = new Map();
  private readonly idJobs: Map<string, Job> = new Map();
  private readonly titleJobs: Map<string, Job[]> = new Map();

  constructor(private readonly db: JsonDB) {
  }

  async onModuleInit(): Promise<void> {
    const jobs = await this.db.getObject<Job[]>('/jobs');

    Object.values(JobStatus)
      .forEach(status => this.statusJobs.set(status, []));

    jobs.forEach((job: Job) =>
      this.cacheJob(job)
    );
  }

  async save(job: Job): Promise<Job> {
    await this.db.push('/jobs[]', job);
    this.cacheJob(job);
    return structuredClone(job);
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
    return structuredClone(this.idJobs.get(id));
  }

  async findAll() {
    return structuredClone(await this.db.getObject<Job[]>('/jobs'));
  }

  async findByParams(title?: string, status?: JobStatus): Promise<Job[]> {

    if (title === undefined && status === undefined) {
      return [];
    }

    if (title === undefined) {
      return structuredClone(this.statusJobs.get(status));
    }

    if (status === undefined) {
      return structuredClone(this.getTitleJobs(title));
    }

    const titleJobs = this.getTitleJobs(title);
    const statusJobs = this.statusJobs.get(status);

    if (titleJobs.length <= statusJobs.length) {
      return structuredClone(titleJobs.filter(job => job.status === status));
    }

    return structuredClone(statusJobs.filter(job => job.title === title));
  }

  private getTitleJobs(title: string): Job[] {
    return this.titleJobs.get(title) ?? [];
  }

  async updateStatus(beforeStatus: JobStatus, afterStatus: JobStatus): Promise<number> {
    if (beforeStatus === afterStatus) {
      return 0;
    }

    const beforeStatusJobs = this.statusJobs.get(beforeStatus);
    const beforeStatusJobsCount = beforeStatusJobs.length;
    const afterStatusJobs = this.statusJobs.get(afterStatus);

    beforeStatusJobs.forEach((job: Job) => job.status = afterStatus);
    this.statusJobs.set(afterStatus, beforeStatusJobs.concat(afterStatusJobs));

    beforeStatusJobs.length = 0;
    await this.db.save();

    return beforeStatusJobsCount;
  }
}
