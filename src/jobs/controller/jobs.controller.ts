import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { JobsInsertRequestDto } from '../dto/jobs.insert.request.dto';
import { JobsService } from '../service/jobs.service';
import { Job } from '../model/job.entity';
import { JobsSearchRequestDto } from '../dto/jobs.search.request.dto';

@Controller('/jobs')
export class JobsController {

  constructor(private readonly jobsService: JobsService) {
  }

  @Post()
  insertNewJob(@Body() jobRequest: JobsInsertRequestDto) {
    const { title, description } = jobRequest;
    return this.jobsService.add(title, description);
  }

  @Get('/search')
  searchJob(@Query() jobSearch: JobsSearchRequestDto) {
    const { title, status } = jobSearch;
    return this.jobsService.search(title, status);
  }

  @Get('/:id')
  async getSpecificJob(@Param('id') id: string): Promise<Job> {
    const job = await this.jobsService.get(id);

    if (job === undefined) {
      throw new NotFoundException();
    }

    return job;
  }

  @Get()
  getAllJob() {
    return this.jobsService.getAll();
  }
}
