import { IsString, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';

export class CompleteReminderDto {
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}
