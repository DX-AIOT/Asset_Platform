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
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: ValuationCondition;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  purchaseYear?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
