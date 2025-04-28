import { IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class JobsInsertRequestDto {
  @IsNotEmpty()
  @Transform(({ value }) => value.trim())
  title: string;

  @IsNotEmpty()
  description: string;
}
