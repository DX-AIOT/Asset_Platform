export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';
export type ListingType = 'sell' | 'rent' | 'auction';
export type ListingStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'paused'
  | 'sold'
  | 'expired'
  | 'cancelled'
  | 'deleted';

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export const CONDITION_COLORS: Record<ListingCondition, string> = {
  new: '#34C759',
  like_new: '#30B94D',
  good: '#007AFF',
  fair: '#FF9500',
  poor: '#FF3B30',
};

export interface SellerSnippet {
  id: string;
  name: string;
  avatar: string | null;
  memberSince: string;
}

export interface Listing {
  id: string;
  itemId: string;
  sellerId: string;
  seller: SellerSnippet;
  title?: string | null;
  price: number;
  currency: string;
  condition: ListingCondition;
  listingType: ListingType;
  status: ListingStatus;
  photos: string[];
  description: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingsPage {
  listings: Listing[];
  total: number;
  page: number;
  limit: number;
}

export interface BrowseListingsQuery {
  q?: string;
  category?: string;
  condition?: ListingCondition;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  limit?: number;
}

export interface CreateListingData {
  itemId: string;
  price: number;
  currency?: string;
  condition: ListingCondition;
  description?: string;
  photos?: string[];
  location?: { lat?: number; lng?: number; city?: string };
  listingType?: ListingType;
}

export interface ListingPriceSuggestion {
  suggestedPrice: number;
  estimatedMarketValue: number;
  priceRange: { low: number; high: number };
  confidence: string;
  currency: string;
  rationale: string;
  cached: boolean;
}

export interface ListingAutofillDraft {
  title: string;
  category: string;
  condition: string;
  description: string;
  photos: string[];
  location: { city: string | null };
}
