import { Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../service/jobs.service';
import { JobStatus } from '../model/job.status';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class JobsBatch {

  private readonly logger = new Logger(JobsBatch.name);

  constructor(private readonly jobsService: JobsService) {
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async pendingToComplete() {
    const updateCount = await this.jobsService.updatePendingJobToCompleteJob();
    this.logger.log(`총 ${ updateCount }개의 job이 배치 처리됨(${ JobStatus.PENDING } -> ${ JobStatus.COMPLETED })`);
  }
}
