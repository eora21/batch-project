import { Job } from '../model/job.entity';
import { JobStatus } from '../model/job.status';

export interface JobsIRepository {
  save(job: Job): Promise<Job>;

  findById(id: string): Promise<Job>;

  findAll(): Promise<Job[]>;

  findByParams(title?: string, status?: JobStatus): Promise<Job[]>;

  updateStatus(beforeStatus: JobStatus, afterStatus: JobStatus): Promise<number>;
}
