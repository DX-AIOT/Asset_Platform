import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCategory, ItemCondition } from '../entities/item.entity';

export class ItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  brand!: string | null;

  @ApiPropertyOptional()
  model!: string | null;

  @ApiProperty({ enum: ItemCategory })
  category!: ItemCategory;

  @ApiPropertyOptional()
  serial!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date' })
  purchaseDate!: Date | null;

  @ApiPropertyOptional({ type: Number })
  purchasePrice!: number | null;

  @ApiProperty({ enum: ItemCondition })
  condition!: ItemCondition;

  @ApiPropertyOptional()
  location!: string | null;

  @ApiProperty({ type: [String] })
  photos!: string[];

  @ApiPropertyOptional({ type: String, format: 'date' })
  warrantyExpiry!: Date | null;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiPropertyOptional({ type: Number })
  depreciatedValue!: number | null;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
