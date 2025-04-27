import { Injectable } from '@nestjs/common';
import { Job } from '../model/job.entity';
import { JobsRepository } from '../dao/jobs.repository';
import { JobStatus } from '../model/job.status';

@Injectable()
export class JobsService {

  constructor(private readonly jobsRepository: JobsRepository) {
  }

  async add(title: string, description: string): Promise<Job> {
    const job = new Job(title, description);
    await this.jobsRepository.save(job);
    return job;
  }

  get(id: string): Promise<Job> {
    return this.jobsRepository.findById(id);
  }

  getAll(): Promise<Job[]> {
    return this.jobsRepository.findAll();
  }

  search(title?: string, status?: string): Promise<Job[]> {
    if (title === undefined && status === undefined) {
      return Promise.resolve([]);
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

    return this.jobsRepository.findByParams(filter);
  }

  updatePendingJobToCompleteJob(): Promise<number> {
    const filter = (job: Job) => job.status === JobStatus.PENDING;
    const update = (job: Job) => job.status = JobStatus.COMPLETED;
    return this.jobsRepository.update(filter, update);
  }
}
