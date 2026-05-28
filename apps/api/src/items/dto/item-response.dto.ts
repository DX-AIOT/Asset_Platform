import { ItemCategory, ItemCondition } from '../entities/item.entity';

export class ItemResponseDto {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: ItemCategory;
  serial: string | null;
  purchaseDate: Date | null;
  purchasePrice: number | null;
  condition: ItemCondition;
  location: string | null;
  photos: string[];
  warrantyExpiry: Date | null;
  notes: string | null;
  depreciatedValue: number | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
