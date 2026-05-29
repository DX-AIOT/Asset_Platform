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

export interface DepreciationHistoryPoint {
  year: number;
  date: string;
  value: number;
}

export interface ItemDepreciationResponse {
  currentValue: number | null;
  percentLost: number | null;
  annualRatePercent: number;
  valueHistory: DepreciationHistoryPoint[];
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

export type PriceHistorySource = 'manual' | 'ai' | 'market';
export type TrendDirection = 'up' | 'flat' | 'down';

export interface PriceHistoryPoint {
  id: string;
  estimatedValue: number;
  currency: string;
  source: PriceHistorySource;
  recordedAt: string;
}

export interface TrendWindow {
  windowDays: 30 | 90 | 365;
  direction: TrendDirection;
  percentChange: number | null;
  fromValue: number | null;
  toValue: number | null;
}

export interface PriceHistoryResponse {
  itemId: string;
  currency: string;
  points: PriceHistoryPoint[];
  latestValue: number | null;
  trends: TrendWindow[];
}

export interface CreateItemInput {
  name: string;
  brand?: string;
  model?: string;
  category?: ItemCategory;
  serial?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  condition?: ItemCondition;
  location?: string;
  photos?: string[];
  warrantyExpiry?: string;
  notes?: string;
  depreciationRatePercent?: number;
}

export type ConditionAssessmentApiCondition = 'excellent' | 'good' | 'fair' | 'poor';

export interface ConditionAssessmentResult {
  condition: ConditionAssessmentApiCondition;
  confidence: number;
  notes: string;
  fallbackSuggested: boolean;
  latencyMs: number;
}

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  [ItemCondition.NEW]: 'New',
  [ItemCondition.LIKE_NEW]: 'Like New',
  [ItemCondition.GOOD]: 'Good',
  [ItemCondition.FAIR]: 'Fair',
  [ItemCondition.POOR]: 'Poor',
};
