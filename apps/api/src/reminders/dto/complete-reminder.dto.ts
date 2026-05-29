import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';

export class CompleteReminderDto {
  @ApiPropertyOptional({ example: '2025-06-15', description: 'When the maintenance was performed (ISO 8601). Defaults to now.' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({ example: 'Changed oil filter too.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 75.00, minimum: 0, description: 'Cost of the maintenance work in the user\'s default currency.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}
