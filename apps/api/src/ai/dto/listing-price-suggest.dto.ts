import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListingType, ValuationCondition } from '@dx-aiot/shared';

const CONDITIONS: ValuationCondition[] = ['new', 'like_new', 'good', 'fair', 'poor'];
const LISTING_TYPES: ListingType[] = ['sell', 'auction', 'trade'];

export class ListingPriceSuggestDto {
  @ApiProperty({ format: 'uuid', example: 'b3f1c2d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d' })
  @IsUUID()
  itemId!: string;

  @ApiPropertyOptional({ enum: CONDITIONS, example: 'good' })
  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: ValuationCondition;

  @ApiPropertyOptional({ enum: LISTING_TYPES, example: 'sell', default: 'sell' })
  @IsOptional()
  @IsIn(LISTING_TYPES)
  listingType?: ListingType;
}
