import { IsString, IsInt, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateReminderDto {
  @IsString()
  title!: string;

  @IsInt()
  @Min(1)
  intervalDays!: number;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
