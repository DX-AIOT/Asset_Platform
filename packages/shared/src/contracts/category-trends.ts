// Data contract for category-level price trends (DXS-181), surfaced on the
// marketplace browse page. Producer is the AI/Data service (MarketTrendsService);
// consumer-facing endpoint is `GET /market/category-trends`.

import { TrendDirection } from './price-history';

/** Aggregated price trend for a single asset category over a trailing window. */
export interface CategoryTrend {
  /** Asset category, e.g. "electronics". */
  category: string;
  /** Mean of each contributing item's latest in-window value, rounded to 2dp. */
  avgValue: number;
  /** Direction of the in-window change; "flat" below the flat threshold. */
  trend: TrendDirection;
  /**
   * Signed percentage change over the window (e.g. 5.2), comparing the mean of
   * items' earliest in-window values to the mean of their latest values.
   * `null` when there is no usable baseline (e.g. a single snapshot).
   */
  percentChange: number | null;
  /** Number of distinct items contributing to this category's aggregate. */
  sampleSize: number;
}

/** Response for `GET /market/category-trends`. */
export interface CategoryTrendsResponse {
  /** ISO 4217 currency code the aggregated values are expressed in. */
  currency: string;
  /** Trailing window (in days) the aggregation covers. */
  windowDays: number;
  /** One entry per category that had history in the window, sorted by category. */
  categories: CategoryTrend[];
}
