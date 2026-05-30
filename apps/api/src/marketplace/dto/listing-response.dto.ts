import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingCondition, ListingStatus, ListingType } from '../entities/listing.entity';

export class SellerSnippetDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  avatar!: string | null;

  @ApiProperty()
  memberSince!: Date;
}

export class ListingResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  itemId!: string;

  @ApiProperty()
  sellerId!: string;

  @ApiProperty({ type: () => SellerSnippetDto })
  seller!: SellerSnippetDto;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: ListingCondition })
  condition!: ListingCondition;

  @ApiProperty({ enum: ListingType })
  listingType!: ListingType;

  @ApiProperty({ enum: ListingStatus })
  status!: ListingStatus;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiProperty({ type: [String] })
  photos!: string[];

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  location!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lat!: number | null;

  @ApiPropertyOptional({ nullable: true })
  lng!: number | null;

  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true })
  publishedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ListingsPageDto {
  @ApiProperty({ type: [ListingResponseDto] })
  listings!: ListingResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class MyListingsPageDto {
  @ApiProperty({ type: [ListingResponseDto] })
  listings!: ListingResponseDto[];

  @ApiProperty()
  total!: number;
}
