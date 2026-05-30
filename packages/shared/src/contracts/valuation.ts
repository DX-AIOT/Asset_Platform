// Data contract for the Market Price Intelligence valuation engine (DXS-62).
// Shared between the AI/Data service (producer) and BackendDev consumers.

export type ValuationConfidence = 'high' | 'medium' | 'low';

export type ValuationCondition =
  | 'new'
  | 'like_new'
  | 'good'
  | 'fair'
  | 'poor';

/**
 * Supported asset categories for valuation. Aligns with the Item entity's
 * ItemCategory enum plus the Phase 2 jewelry/watches addition. Any value not
 * listed here is treated as unsupported and resolved with a low-confidence
 * fallback estimate.
 */
export type ValuationCategory =
  | 'electronics'
  | 'mobile_phones'
  | 'laptops'
  | 'tablets'
  | 'appliances'
  | 'furniture'
  | 'vehicles'
  | 'jewelry'
  | 'watches';

export interface ValuationRequest {
  /** Free-text asset name, e.g. "iPhone 14 Pro". */
  name: string;
  /** Category hint; unsupported values fall back to a low-confidence estimate. */
  category: string;
  /** Physical condition; defaults to "good" when omitted. */
  condition?: ValuationCondition;
  /** Four-digit purchase year, used to compute depreciation age. */
  purchaseYear?: number;
  /** Original purchase price, used as a baseline anchor when set. */
  purchasePrice?: number;
  /** ISO 4217 currency code; defaults to "USD". */
  currency?: string;
}

export interface ValuationComparable {
  /** Reference source, e.g. "market-reference", "ebay-sold". */
  source: string;
  /** Human-readable comparable title. */
  title: string;
  /** Comparable price in `currency`. */
  price: number;
  currency: string;
  /** Optional ISO date the comparable was observed/sold. */
  soldDate?: string;
  /** 0..1 similarity between the request and this comparable. */
  matchScore: number;
}

export interface ValuationBasis {
  /** Reference "new" price the estimate was derived from. */
  baselinePrice: number;
  /** Age in years used for depreciation. */
  ageYears: number;
  /** 0..1 residual factor applied for age + category. */
  depreciationFactor: number;
  /** 0..1 multiplier applied for condition. */
  conditionFactor: number;
  /** How the baseline was sourced. */
  method: 'comparable' | 'purchase_price' | 'category_median';
}

export interface ValuationResult {
  estimatedValue: number;
  currency: string;
  confidence: ValuationConfidence;
  comparables: ValuationComparable[];
  basis: ValuationBasis;
  /** Normalized category actually used (or "other" when unsupported). */
  category: string;
  /** True when served from cache. */
  cached: boolean;
}
