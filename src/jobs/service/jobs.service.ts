import { Inject, Injectable } from '@nestjs/common';
import { Job } from '../model/job.entity';
import { JobStatus } from '../model/job.status';
import { JobsIRepository } from '../repository/jobs.interface.repository';

@Injectable()
export class JobsService {

  constructor(@Inject('JOBS_REPOSITORY') private readonly jobsRepository: JobsIRepository) {
  }

  async add(title: string, description: string): Promise<Job> {
    const job = new Job(title, description);
    return await this.jobsRepository.save(job);
  }

  get(id: string): Promise<Job> {
    return this.jobsRepository.findById(id);
  }

  getAll(): Promise<Job[]> {
    return this.jobsRepository.findAll();
  }

  search(title?: string, status?: JobStatus): Promise<Job[]> {
    return this.jobsRepository.findByParams(title, status);
  }

  updatePendingJobToCompleteJob(): Promise<number> {
    return this.jobsRepository.updateStatus(JobStatus.PENDING, JobStatus.COMPLETED);
  }
}
