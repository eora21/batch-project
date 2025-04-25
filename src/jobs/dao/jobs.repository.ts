import { Injectable } from '@nestjs/common';
import { Config, JsonDB } from 'node-json-db';
import { Job } from '../model/job.entity';

@Injectable()
export class JobsRepository {
  readonly db: JsonDB = new JsonDB(new Config('jobs', true, true));

  async save(job: Job) {
    await this.db.push('/jobs[]', job);
  }
}
