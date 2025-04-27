import { Injectable, NotFoundException } from '@nestjs/common';
import { Config, JsonDB } from 'node-json-db';
import { Job } from '../model/job.entity';

@Injectable()
export class JobsRepository {
  readonly db: JsonDB = new JsonDB(new Config('jobs', true, true));

  async save(job: Job) {
    await this.db.push('/jobs[]', job);
  }

  async findById(id: string) {
    const normalPath = await this.db.fromPath(`/jobs/${ id }`);

    if (normalPath.endsWith('[-1]')) {
      throw new NotFoundException();
    }

    return structuredClone(await this.db.getObject<Job>(normalPath));
  }

  async findAll() {
    return structuredClone(await this.db.getObject<Job[]>('/jobs'));
  }

  async findByParams(filterCallback: (job: Job) => boolean): Promise<Job[]> {
    return structuredClone(await this.db.filter<Job>('/jobs', filterCallback));
  }

  async update(filterCallback: (job: Job) => boolean, updateCallback: (job: Job) => void) {
    const filteredJobs = await this.db.filter<Job>('/jobs', filterCallback);
    filteredJobs.forEach(updateCallback);
    await this.db.save();
    return filteredJobs.length;
  }
}
