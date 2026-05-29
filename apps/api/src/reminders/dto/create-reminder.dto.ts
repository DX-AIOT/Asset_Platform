import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateReminderDto {
  @ApiProperty({ example: 'Oil change', description: 'Human-readable title for this maintenance task.' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 90, minimum: 1, description: 'How often the maintenance recurs, in days.' })
  @IsInt()
  @Min(1)
  intervalDays!: number;

  @ApiPropertyOptional({ example: '2025-09-01', description: 'First due date (ISO 8601). Defaults to today + intervalDays.' })
  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @ApiPropertyOptional({ example: 'Use 5W-30 synthetic oil.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
