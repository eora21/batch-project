import { Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../service/jobs.service';
import { JobStatus } from '../model/job.status';
import { Job } from '../model/job.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class JobsBatch {

  private readonly logger = new Logger(JobsBatch.name);

  constructor(private readonly jobsService: JobsService) {
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async pendingToComplete() {
    const jobs: Job[] = await this.jobsService.search(undefined, JobStatus.PENDING);

    if (jobs.length === 0) {
      return;
    }

    jobs.forEach(job => job.status = JobStatus.COMPLETED);
    await this.jobsService.update();
    this.logger.log(`총 ${ jobs.length }개의 job이 ${ JobStatus.COMPLETED }됨`);
  }
}
