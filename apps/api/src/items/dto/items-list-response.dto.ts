import { ApiProperty } from '@nestjs/swagger';
import { ItemResponseDto } from './item-response.dto';

export class ItemsListResponseDto {
  @ApiProperty({ type: [ItemResponseDto] })
  items!: ItemResponseDto[];

  @ApiProperty({ description: 'Total number of matching assets.' })
  total!: number;
}
