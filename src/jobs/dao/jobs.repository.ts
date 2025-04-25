import { Injectable } from '@nestjs/common';
import { Config, JsonDB } from 'node-json-db';

@Injectable()
export class JobsRepository {
  readonly db: JsonDB = new JsonDB(new Config("jobs", true, true));
}
