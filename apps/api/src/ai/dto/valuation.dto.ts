import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ValuationCondition } from '@dx-aiot/shared';

const CONDITIONS: ValuationCondition[] = ['new', 'like_new', 'good', 'fair', 'poor'];

export class ValuationRequestDto {
  @ApiProperty({ example: 'MacBook Pro 14"' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'laptops' })
  @IsString()
  @MinLength(1)
  category!: string;

  @ApiPropertyOptional({ enum: CONDITIONS, example: 'good' })
  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: ValuationCondition;

  @ApiPropertyOptional({ example: 2022, minimum: 1950, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  purchaseYear?: number;

  @ApiPropertyOptional({ example: 2499.99 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}
