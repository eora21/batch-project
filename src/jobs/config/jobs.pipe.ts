import { ValidationPipe } from '@nestjs/common';

export const jobsValidationPipe = new ValidationPipe({
  transform: true,
});
