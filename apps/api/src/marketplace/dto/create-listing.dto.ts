import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsPositive,
  ValidateNested,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingCondition, ListingType } from '../entities/listing.entity';

export class ListingLocationDto {
  @ApiPropertyOptional({ example: 13.7563 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 100.5018 })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ example: 'Bangkok' })
  @IsOptional()
  @IsString()
  city?: string;
}

export class CreateListingDto {
  @ApiProperty({ description: 'ID of an item owned by the caller' })
  @IsUUID()
  itemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 299.99 })
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: ListingCondition })
  @IsEnum(ListingCondition)
  condition!: ListingCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({ type: () => ListingLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ListingLocationDto)
  location?: ListingLocationDto;

  @ApiPropertyOptional({ enum: ListingType, default: ListingType.SELL })
  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;
}
