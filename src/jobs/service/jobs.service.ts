import { Injectable } from '@nestjs/common';
import { Job } from '../model/job.entity';
import { JobsRepository } from '../dao/jobs.repository';

@Injectable()
export class JobsService {

  constructor(readonly jobsRepository: JobsRepository) {
  }

  async add(title: string, description: string): Promise<Job> {
    const job = new Job(title, description);
    await this.jobsRepository.save(job);
    return job;
  }

  get(id: string): Promise<Job> {
    return this.jobsRepository.findById(id);
  }
}
