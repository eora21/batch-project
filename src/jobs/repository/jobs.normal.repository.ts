import { Injectable } from '@nestjs/common';
import { JsonDB } from 'node-json-db';
import { Job } from '../model/job.entity';
import { JobsIRepository } from './jobs.interface.repository';
import { JobStatus } from '../model/job.status';

@Injectable()
export class JobsNormalRepository implements JobsIRepository {

  constructor(private readonly db: JsonDB) {
  }

  async save(job: Job) {
    await this.db.push('/jobs[]', job);
    return structuredClone(job);
  }

  async findById(id: string) {
    const normalPath = await this.db.fromPath(`/jobs/${ id }`);

    if (normalPath.endsWith('[-1]')) {
      return undefined;
    }

    return structuredClone(await this.db.getObject<Job>(normalPath));
  }

  async findAll() {
    return structuredClone(await this.db.getObject<Job[]>('/jobs'));
  }

  async findByParams(title?: string, status?: JobStatus): Promise<Job[]> {
    if (title === undefined && status === undefined) {
      return [];
    }

    const filter = (job: Job): boolean => {
      if (title && job.title !== title) {
        return false;
      }

      if (status && job.status !== status) {
        return false;
      }

      return true;
    };

    return structuredClone(await this.db.filter<Job>('/jobs', filter));
  }

  async updateStatus(beforeStatus: JobStatus, afterStatus: JobStatus): Promise<number> {

    if (beforeStatus === afterStatus) {
      return 0;
    }

    const filteredJobs = await this.db.filter<Job>('/jobs', (job: Job) => job.status === beforeStatus);
    filteredJobs.forEach((job: Job) => job.status = afterStatus);
    await this.db.save();
    return filteredJobs.length;
  }
}
