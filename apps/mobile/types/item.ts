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

export type EscrowStatus = 'HELD' | 'RELEASED' | 'DISPUTED' | 'REFUNDED';

export type DisputeReason =
  | 'Item not received'
  | 'Item differs from description'
  | 'Damaged'
  | 'Other';

export interface Transaction {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  escrowStatus: EscrowStatus;
  escrowHeldAt: string;
  escrowAutoReleaseAt: string;
  disputeReason?: string;
  disputeDescription?: string;
  disputeFiledAt?: string;
  releasedAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
  listingTitle?: string;
  buyerName?: string;
  sellerName?: string;
}

export interface FiledDispute {
  reason: DisputeReason;
  description: string;
}

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  HELD: 'Held in Escrow',
  RELEASED: 'Released to Seller',
  DISPUTED: 'Under Dispute',
  REFUNDED: 'Refunded',
};

export const ESCROW_STATUS_COLORS: Record<EscrowStatus, string> = {
  HELD: '#007AFF',
  RELEASED: '#34C759',
  DISPUTED: '#FF9500',
  REFUNDED: '#8E8E93',
};

export const DISPUTE_REASONS: DisputeReason[] = [
  'Item not received',
  'Item differs from description',
  'Damaged',
  'Other',
];
