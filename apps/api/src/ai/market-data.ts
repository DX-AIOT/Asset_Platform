import { ValuationCategory, ValuationCondition } from '@dx-aiot/shared';

/**
 * Per-category depreciation profile.
 *
 * residual(age) = max(floor, (1 - annualRate) ^ age)
 *
 * Rates are derived from common secondhand-market depreciation curves:
 * consumer electronics lose value fastest, jewelry/watches the slowest.
 */
export interface DepreciationProfile {
  annualRate: number;
  /** Minimum residual fraction of baseline, never decays below this. */
  floor: number;
}

export const DEPRECIATION_PROFILES: Record<ValuationCategory, DepreciationProfile> = {
  mobile_phones: { annualRate: 0.22, floor: 0.08 },
  laptops: { annualRate: 0.2, floor: 0.1 },
  tablets: { annualRate: 0.21, floor: 0.08 },
  electronics: { annualRate: 0.18, floor: 0.1 },
  appliances: { annualRate: 0.12, floor: 0.1 },
  furniture: { annualRate: 0.08, floor: 0.2 },
  vehicles: { annualRate: 0.15, floor: 0.1 },
  jewelry: { annualRate: 0.04, floor: 0.5 },
  watches: { annualRate: 0.04, floor: 0.5 },
};

/** Fallback profile used for unsupported categories. */
export const FALLBACK_DEPRECIATION: DepreciationProfile = { annualRate: 0.15, floor: 0.1 };

/**
 * Condition multipliers applied on top of age depreciation. Resale buyers pay
 * a premium for near-new condition and discount heavily for poor condition.
 */
export const CONDITION_FACTORS: Record<ValuationCondition, number> = {
  new: 1.0,
  like_new: 0.92,
  good: 0.8,
  fair: 0.6,
  poor: 0.4,
};

export const DEFAULT_CONDITION: ValuationCondition = 'good';

export interface MarketComparable {
  /** Normalized category for the comparable. */
  category: ValuationCategory;
  /** Comparable display title. */
  title: string;
  /** Keyword tokens used to match a request name to this comparable. */
  keywords: string[];
  /** Reference "new"/MSRP price in USD. */
  basePrice: number;
}

/**
 * Seeded market-reference dataset. Mirrors the seeded-map approach used by
 * BarcodeLookupService: a deterministic, offline-friendly corpus of comparable
 * "new" prices. A live price-API/scraper adapter can later replace or augment
 * this corpus without changing the valuation algorithm or the response shape.
 */
export const MARKET_COMPARABLES: MarketComparable[] = [
  // --- Mobile phones ---
  { category: 'mobile_phones', title: 'Apple iPhone 14 Pro', keywords: ['iphone', '14', 'pro', 'apple'], basePrice: 1099 },
  { category: 'mobile_phones', title: 'Apple iPhone 13', keywords: ['iphone', '13', 'apple'], basePrice: 799 },
  { category: 'mobile_phones', title: 'Samsung Galaxy S23', keywords: ['samsung', 'galaxy', 's23'], basePrice: 899 },
  { category: 'mobile_phones', title: 'Google Pixel 7', keywords: ['google', 'pixel', '7'], basePrice: 599 },
  // --- Laptops ---
  { category: 'laptops', title: 'Apple MacBook Pro 16"', keywords: ['macbook', 'pro', '16', 'apple', 'mac'], basePrice: 2499 },
  { category: 'laptops', title: 'Apple MacBook Air M2', keywords: ['macbook', 'air', 'm2', 'apple'], basePrice: 1199 },
  { category: 'laptops', title: 'Dell XPS 13', keywords: ['dell', 'xps', '13'], basePrice: 999 },
  { category: 'laptops', title: 'Lenovo ThinkPad X1', keywords: ['lenovo', 'thinkpad', 'x1'], basePrice: 1399 },
  // --- Tablets ---
  { category: 'tablets', title: 'Apple iPad Pro 11"', keywords: ['ipad', 'pro', '11', 'apple'], basePrice: 799 },
  { category: 'tablets', title: 'Apple iPad Air', keywords: ['ipad', 'air', 'apple'], basePrice: 599 },
  { category: 'tablets', title: 'Samsung Galaxy Tab S8', keywords: ['samsung', 'galaxy', 'tab', 's8'], basePrice: 699 },
  // --- Electronics (general) ---
  { category: 'electronics', title: 'Sony WH-1000XM5 Headphones', keywords: ['sony', 'headphones', 'wh', '1000xm5'], basePrice: 399 },
  { category: 'electronics', title: 'LG OLED C2 55" TV', keywords: ['lg', 'oled', 'tv', 'c2', 'television'], basePrice: 1499 },
  { category: 'electronics', title: 'Canon EOS R6 Camera', keywords: ['canon', 'eos', 'camera', 'r6'], basePrice: 2499 },
  // --- Appliances ---
  { category: 'appliances', title: 'Samsung French Door Refrigerator', keywords: ['samsung', 'refrigerator', 'fridge'], basePrice: 1899 },
  { category: 'appliances', title: 'LG Front Load Washing Machine', keywords: ['lg', 'washing', 'machine', 'washer'], basePrice: 899 },
  { category: 'appliances', title: 'Daikin Inverter Air Conditioner', keywords: ['daikin', 'air', 'conditioner', 'ac'], basePrice: 749 },
  { category: 'appliances', title: 'Dyson V15 Vacuum', keywords: ['dyson', 'vacuum', 'v15'], basePrice: 749 },
  // --- Furniture ---
  { category: 'furniture', title: 'Herman Miller Aeron Chair', keywords: ['herman', 'miller', 'aeron', 'chair'], basePrice: 1395 },
  { category: 'furniture', title: 'IKEA MALM Bed Frame', keywords: ['ikea', 'malm', 'bed'], basePrice: 299 },
  { category: 'furniture', title: 'Leather 3-Seat Sofa', keywords: ['leather', 'sofa', 'couch'], basePrice: 1200 },
  { category: 'furniture', title: 'Solid Oak Dining Table', keywords: ['oak', 'dining', 'table'], basePrice: 850 },
  // --- Vehicles ---
  { category: 'vehicles', title: 'Honda Wave Alpha 110', keywords: ['honda', 'wave', 'alpha', '110'], basePrice: 1250 },
  { category: 'vehicles', title: 'Yamaha Exciter 155', keywords: ['yamaha', 'exciter', '155'], basePrice: 2100 },
  { category: 'vehicles', title: 'Honda Air Blade 160', keywords: ['honda', 'air', 'blade', '160'], basePrice: 2400 },
  { category: 'vehicles', title: 'Toyota Vios Sedan', keywords: ['toyota', 'vios', 'sedan', 'car'], basePrice: 20000 },
  // --- Jewelry / watches ---
  { category: 'watches', title: 'Rolex Submariner', keywords: ['rolex', 'submariner', 'watch'], basePrice: 9500 },
  { category: 'watches', title: 'Omega Seamaster', keywords: ['omega', 'seamaster', 'watch'], basePrice: 5500 },
  { category: 'watches', title: 'Apple Watch Series 8', keywords: ['apple', 'watch', 'series', '8'], basePrice: 399 },
  { category: 'jewelry', title: '18k Gold Diamond Ring', keywords: ['gold', 'diamond', 'ring', 'jewelry'], basePrice: 2500 },
  { category: 'jewelry', title: 'Pearl Necklace', keywords: ['pearl', 'necklace', 'jewelry'], basePrice: 800 },
];

/**
 * Median reference baseline per supported category, used when no comparable
 * matches and no purchase price is supplied. Computed offline from the corpus
 * above to keep startup cheap; update alongside MARKET_COMPARABLES.
 */
export const CATEGORY_MEDIAN_BASELINE: Record<ValuationCategory, number> = {
  mobile_phones: 849,
  laptops: 1299,
  tablets: 699,
  electronics: 1499,
  appliances: 824,
  furniture: 850,
  vehicles: 2250,
  jewelry: 1650,
  watches: 5500,
};

/** Categories the engine has reference data for. */
export const SUPPORTED_CATEGORIES: ValuationCategory[] = [
  'mobile_phones',
  'laptops',
  'tablets',
  'electronics',
  'appliances',
  'furniture',
  'vehicles',
  'jewelry',
  'watches',
];

/**
 * Normalize an arbitrary inbound category string to a supported
 * ValuationCategory, or null when unsupported.
 */
export function normalizeCategory(raw: string | undefined): ValuationCategory | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');

  const aliases: Record<string, ValuationCategory> = {
    mobile_phones: 'mobile_phones',
    mobile_phone: 'mobile_phones',
    phone: 'mobile_phones',
    phones: 'mobile_phones',
    smartphone: 'mobile_phones',
    laptop: 'laptops',
    laptops: 'laptops',
    notebook: 'laptops',
    tablet: 'tablets',
    tablets: 'tablets',
    electronics: 'electronics',
    electronic: 'electronics',
    appliance: 'appliances',
    appliances: 'appliances',
    furniture: 'furniture',
    vehicle: 'vehicles',
    vehicles: 'vehicles',
    motorbike: 'vehicles',
    car: 'vehicles',
    jewelry: 'jewelry',
    jewellery: 'jewelry',
    watch: 'watches',
    watches: 'watches',
  };

  return aliases[value] ?? null;
}
