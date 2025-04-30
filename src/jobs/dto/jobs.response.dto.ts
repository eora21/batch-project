import { JobStatus } from '../model/job.status';
import { Job } from '../model/job.entity';

export class JobsResponseDto {
  public readonly id: string;
  public readonly title: string;
  public readonly description: string;
  public readonly status: JobStatus;

  constructor(job: Job) {
    this.id = job.id;
    this.title = job.title;
    this.description = job.description;
    this.status = job.status;
  }
}
