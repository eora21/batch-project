import { Body, Controller, Post } from '@nestjs/common';
import { JobsInsertRequestDto } from '../dto/jobs.insert.request.dto';
import { JobsService } from '../service/jobs.service';

@Controller('/jobs')
export class JobsController {

  constructor(private readonly jobsService: JobsService) {
  }

  @Post()
  insertNewJob(@Body() jobRequest: JobsInsertRequestDto) {
    return this.jobsService.add(jobRequest.title, jobRequest.description);
  }
}
