export enum ItemCategory {
  ELECTRONICS = 'electronics',
  MOBILE_PHONES = 'mobile_phones',
  LAPTOPS = 'laptops',
  VEHICLES = 'vehicles',
  FURNITURE = 'furniture',
  APPLIANCES = 'appliances',
  OTHER = 'other',
}

export enum ItemCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

export interface Item {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  category: ItemCategory;
  serial?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  condition: ItemCondition;
  location?: string;
  photos?: string[];
  warrantyExpiry?: string;
  notes?: string;
  depreciatedValue?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistoryPoint {
  id: string;
  estimatedValue: number;
  currency: string;
  source: string;
  recordedAt: string;
}

export type TrendDirection = 'up' | 'flat' | 'down';

export interface TrendWindow {
  windowDays: number;
  direction: TrendDirection;
  percentChange: number;
  fromValue: number | null;
  toValue: number | null;
}

export interface PriceHistoryResponse {
  points: PriceHistoryPoint[];
  latestValue: number | null;
  trends: TrendWindow[];
}

export interface CreateItemDto {
  name: string;
  brand?: string;
  model?: string;
  category: ItemCategory;
  serial?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  condition?: ItemCondition;
  location?: string;
  photos?: string[];
  notes?: string;
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  [ItemCategory.ELECTRONICS]: 'Electronics',
  [ItemCategory.MOBILE_PHONES]: 'Mobile Phones',
  [ItemCategory.LAPTOPS]: 'Laptops',
  [ItemCategory.VEHICLES]: 'Vehicles',
  [ItemCategory.FURNITURE]: 'Furniture',
  [ItemCategory.APPLIANCES]: 'Appliances',
  [ItemCategory.OTHER]: 'Other',
};

export const LOCATION_OPTIONS = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Office',
  'Garage',
  'Storage',
  'Other',
];
