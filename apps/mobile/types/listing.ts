import { ItemCategory, ItemCondition } from './item';

export enum ListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  joinedAt?: string;
}

export interface Listing {
  id: string;
  title: string;
  description?: string;
  price: number;
  condition: ItemCondition;
  category: ItemCategory;
  photos: string[];
  status: ListingStatus;
  seller: Seller;
  itemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListingDto {
  title: string;
  description?: string;
  price: number;
  condition: ItemCondition;
  category: ItemCategory;
  photos?: string[];
  itemId?: string;
}

export interface ListingsResponse {
  listings: Listing[];
  total: number;
  page: number;
  limit: number;
}

export interface ListingFilters {
  q?: string;
  category?: ItemCategory;
  condition?: ItemCondition;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface PriceSuggestion {
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  rationale: string;
}
