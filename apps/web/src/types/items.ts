export enum ItemCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

export enum ItemCategory {
  ELECTRONICS = 'electronics',
  MOBILE_PHONES = 'mobile_phones',
  LAPTOPS = 'laptops',
  VEHICLES = 'vehicles',
  FURNITURE = 'furniture',
  APPLIANCES = 'appliances',
  OTHER = 'other',
}

export interface Item {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: ItemCategory;
  serial: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  condition: ItemCondition;
  location: string | null;
  photos: string[];
  warrantyExpiry: string | null;
  notes: string | null;
  depreciatedValue: number | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemsListResponse {
  items: Item[];
  total: number;
}

export interface PortfolioValueResponse {
  total: number;
  depreciated: number;
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

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  [ItemCondition.NEW]: 'New',
  [ItemCondition.LIKE_NEW]: 'Like New',
  [ItemCondition.GOOD]: 'Good',
  [ItemCondition.FAIR]: 'Fair',
  [ItemCondition.POOR]: 'Poor',
};
