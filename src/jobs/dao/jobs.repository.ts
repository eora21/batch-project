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

    return this.db.getObject<Job>(normalPath);
  }

  findAll() {
    return this.db.getObject<Job[]>('/jobs');
  }

  findByParams(title?: string, status?: string): Promise<Job[]> {
    if (title === undefined && status === undefined) {
      return Promise.resolve([]);
    }

    return this.db.filter<Job>('/jobs', (job: Job): boolean => {
      if (title && job.title !== title) {
        return false;
      }

      if (status && job.status !== status) {
        return false;
      }

      return true;
    });
  }
}
