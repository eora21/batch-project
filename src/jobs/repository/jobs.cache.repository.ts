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

    const putIdJob = (job: Job) => {
      this.idJobs.set(job.id, job);
    };

    const addTitleJob = (job: Job) => {
      let titleJobs = this.titleJobs.get(job.title);

      if (titleJobs === undefined) {
        titleJobs = [];
        this.titleJobs.set(job.title, titleJobs);
      }

      titleJobs.push(job);
    };

    jobs.forEach((job: Job) => {
      this.addStatusJobs(job);
      putIdJob(job);
      addTitleJob(job);
    });
  }

  async save(job: Job): Promise<Job> {
    await this.db.push('/jobs[]', job);
    this.addStatusJobs(job);
    return structuredClone(job);
  }

  private addStatusJobs(job: Job) {
    this.statusJobs.get(job.status)
      .push(job);
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
      return structuredClone(this.titleJobs.get(title));
    }

    const titleJobs = this.titleJobs.get(title);
    const statusJobs = new Set(this.statusJobs.get(status));

    return structuredClone(titleJobs.filter(titleJob => statusJobs.has(titleJob)));
  }

  async updateStatus(beforeStatus: JobStatus, afterStatus: JobStatus): Promise<number> {
    if (beforeStatus === afterStatus) {
      return 0;
    }

    const beforeStatusJobs = this.statusJobs.get(beforeStatus);
    const beforeStatusJobsCount = beforeStatusJobs.length;
    const afterStatusJobs = this.statusJobs.get(afterStatus);

    beforeStatusJobs.forEach((job: Job) => job.status = afterStatus);
    afterStatusJobs.push(...beforeStatusJobs);
    beforeStatusJobs.length = 0;
    await this.db.save();

    return beforeStatusJobsCount;
  }
}
