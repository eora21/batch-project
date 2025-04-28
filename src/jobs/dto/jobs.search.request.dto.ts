import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JobStatus } from '../model/job.status';

export class JobsSearchRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
