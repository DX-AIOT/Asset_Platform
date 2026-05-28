import { ItemResponseDto } from './item-response.dto';

export class ItemsListResponseDto {
  items: ItemResponseDto[];
  total: number;
}
