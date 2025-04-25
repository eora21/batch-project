import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JobsInsertRequestDto } from '../dto/jobs.insert.request.dto';
import { JobsService } from '../service/jobs.service';
import { Job } from '../model/job.entity';

@Controller('/jobs')
export class JobsController {

  constructor(private readonly jobsService: JobsService) {
  }

  @Post()
  insertNewJob(@Body() jobRequest: JobsInsertRequestDto) {
    return this.jobsService.add(jobRequest.title, jobRequest.description);
  }

  @Get('/search')
  searchJob(@Query('title') title?: string, @Query('status') status?: string) {
    return this.jobsService.search(title, status);
  }
  
  @Get('/:id')
  getSpecificJob(@Param('id') id: string): Promise<Job> {
    return this.jobsService.get(id);
  }

  @Get()
  getAllJob() {
    return this.jobsService.getAll();
  }
}
