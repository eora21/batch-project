import { Injectable } from '@nestjs/common';
import { JsonDB } from 'node-json-db';
import { Job } from '../model/job.entity';
import { JobsIRepository } from './jobs.interface.repository';
import { JobStatus } from '../model/job.status';
import { JobsResponseDto } from '../dto/jobs.response.dto';

@Injectable()
export class JobsNormalRepository implements JobsIRepository {

  constructor(private readonly db: JsonDB) {
  }

  async save(job: Job) {
    await this.db.push('/jobs[]', job);
    return new JobsResponseDto(job);
  }

  async findById(id: string) {
    const normalPath = await this.db.fromPath(`/jobs/${ id }`);

    if (normalPath.endsWith('[-1]')) {
      return undefined;
    }

    return new JobsResponseDto(await this.db.getObject<Job>(normalPath));
  }

  async findAll() {
    return (await this.db.getObject<Job[]>('/jobs'))
      .map(job => new JobsResponseDto(job));
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

    return (await this.db.filter<Job>('/jobs', filter))
      .map(job => new JobsResponseDto(job));
  }

  async completePendingJobs(): Promise<number> {
    const filteredJobs = await this.db.filter<Job>('/jobs', (job: Job) => job.status === JobStatus.PENDING);
    filteredJobs.forEach((job: Job) => job.status = JobStatus.COMPLETED);
    await this.db.save();
    return filteredJobs.length;
  }
}
