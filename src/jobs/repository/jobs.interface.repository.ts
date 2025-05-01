import { Job } from '../model/job.entity';
import { JobStatus } from '../model/job.status';
import { JobsResponseDto } from '../dto/jobs.response.dto';

export interface JobsIRepository {
  save(job: Job): Promise<JobsResponseDto>;

  findById(id: string): Promise<JobsResponseDto>;

  findAll(): Promise<JobsResponseDto[]>;

  findByParams(title?: string, status?: JobStatus): Promise<JobsResponseDto[]>;

  completePendingJobs(): Promise<number>;
}
