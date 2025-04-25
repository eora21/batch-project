import { JobStatus } from './job.status';
import { v7 as uuid } from 'uuid';

export class Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;


  constructor(title: string, description: string) {
    this.id = uuid();
    this.title = title;
    this.description = description;
    this.status = JobStatus.PENDING;
  }
}
