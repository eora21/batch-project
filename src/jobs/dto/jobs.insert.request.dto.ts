import { IsNotEmpty } from 'class-validator';

export class JobsInsertRequestDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  description: string;
}
