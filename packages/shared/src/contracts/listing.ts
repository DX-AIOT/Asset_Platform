// Data contract for the Listing Assistant features (DXS-145):
//   1. Suggested listing price  (POST /ai/listing-price-suggest)
//   2. Listing auto-fill         (GET  /ai/listing-autofill/:itemId)
//
// Both reuse the Market Price Intelligence valuation engine (DXS-62). Shared
// between the AI/Data service (producer) and BackendDev/Frontend consumers.

import { ValuationConfidence, ValuationCondition } from './valuation';

export type ListingType = 'sell' | 'auction' | 'trade';

export interface ListingPriceSuggestRequest {
  /** Item to price; must exist in the items table. */
  itemId: string;
  /** Physical condition override; defaults to the stored item condition. */
  condition?: ValuationCondition;
  /** Listing intent. Currently informational; reserved for future pricing rules. */
  listingType?: ListingType;
}

export interface ListingPriceRange {
  low: number;
  high: number;
}

export interface ListingPriceSuggestion {
  /** Recommended list price (market value + seller premium), in `currency`. */
  suggestedPrice: number;
  /** Underlying estimated resale value before the seller premium. */
  estimatedMarketValue: number;
  /** Plausible negotiation band around the estimate. */
  priceRange: ListingPriceRange;
  /** Confidence inherited from the valuation engine. */
  confidence: ValuationConfidence;
  /** ISO 4217 currency code of every monetary field above. */
  currency: string;
  /** Human-readable explanation of how the price was derived. */
  rationale: string;
  /** True when served from the 24h suggestion cache. */
  cached: boolean;
}

export interface ListingLocation {
  city: string | null;
}

export interface ListingAutofillDraft {
  /** Suggested listing title (item name, optionally brand/model qualified). */
  title: string;
  /** Marketplace category derived from the item category. */
  category: string;
  /** Item condition. */
  condition: ValuationCondition;
  /** Brief, factual description skeleton. No invented specifications. */
  description: string;
  /** Asset photo URLs, in stored order. */
  photos: string[];
  /** Location pulled from the item record. */
  location: ListingLocation;
}
