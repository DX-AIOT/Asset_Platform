import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsDateString, Min } from 'class-validator';

export class UpdateReminderDto {
  @ApiPropertyOptional({ example: 'Oil change' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 90, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @ApiPropertyOptional({ example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
