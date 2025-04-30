import { Inject, Injectable } from '@nestjs/common';
import { Job } from '../model/job.entity';
import { JobStatus } from '../model/job.status';
import { JobsIRepository } from '../repository/jobs.interface.repository';
import { JobsResponseDto } from '../dto/jobs.response.dto';

@Injectable()
export class JobsService {

  constructor(@Inject('JOBS_REPOSITORY') private readonly jobsRepository: JobsIRepository) {
  }

  async add(title: string, description: string): Promise<JobsResponseDto> {
    const job = new Job(title, description);
    return await this.jobsRepository.save(job);
  }

  get(id: string): Promise<JobsResponseDto> {
    return this.jobsRepository.findById(id);
  }

  getAll(): Promise<JobsResponseDto[]> {
    return this.jobsRepository.findAll();
  }

  search(title?: string, status?: JobStatus): Promise<JobsResponseDto[]> {
    return this.jobsRepository.findByParams(title, status);
  }

  updatePendingJobToCompleteJob(): Promise<number> {
    return this.jobsRepository.updateStatus(JobStatus.PENDING, JobStatus.COMPLETED);
  }
}
