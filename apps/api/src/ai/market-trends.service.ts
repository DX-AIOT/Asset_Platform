import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CategoryTrend,
  CategoryTrendsResponse,
  TrendDirection,
} from '@dx-aiot/shared';
import { Item } from '../items/entities/item.entity';
import { PriceHistory } from '../items/entities/price-history.entity';

/** Trailing window the category aggregation covers. */
export const CATEGORY_TREND_WINDOW_DAYS = 30;
/** Cached response lifetime — 6h per acceptance criteria. */
export const CATEGORY_TREND_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Below this absolute % change a category is reported as "flat". */
const FLAT_THRESHOLD_PERCENT = 0.5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CURRENCY = 'USD';

/** One in-window price-history row joined with its item's category. */
interface TrendRow {
  itemId: string;
  category: string;
  estimatedValue: number;
  currency: string;
  recordedAt: Date;
}

/**
 * Category-level price-trend aggregation for the marketplace browse page
 * (DXS-181). Aggregates the trailing 30 days of price history per category and
 * caches the whole response in-process for 6h (single key — the aggregate is
 * global, not per-user). Redis is intentionally avoided here: the result is
 * small, cheap to recompute, and tolerant of being recomputed per-instance.
 */
@Injectable()
export class MarketTrendsService {
  private cache: { value: CategoryTrendsResponse; expiresAt: number } | null = null;

  constructor(
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepository: Repository<PriceHistory>,
  ) {}

  /**
   * Return per-category trends over the trailing 30 days, served from cache
   * when warm. Time: O(r) over in-window rows (one indexed range scan + group).
   *
   * @param now reference time (injectable for testing).
   */
  async getCategoryTrends(now: Date = new Date()): Promise<CategoryTrendsResponse> {
    const nowMs = now.getTime();
    if (this.cache && this.cache.expiresAt > nowMs) {
      return this.cache.value;
    }

    const since = new Date(nowMs - CATEGORY_TREND_WINDOW_DAYS * MS_PER_DAY);
    const rows = await this.fetchWindowRows(since);
    const value = MarketTrendsService.aggregate(rows);

    this.cache = { value, expiresAt: nowMs + CATEGORY_TREND_CACHE_TTL_MS };
    return value;
  }

  /** Drop the cached aggregate (e.g. after a bulk refresh). */
  invalidate(): void {
    this.cache = null;
  }

  private async fetchWindowRows(since: Date): Promise<TrendRow[]> {
    const raw = await this.priceHistoryRepository
      .createQueryBuilder('ph')
      .innerJoin(Item, 'item', 'item.id = ph.itemId')
      .select('ph.itemId', 'itemId')
      .addSelect('item.category', 'category')
      .addSelect('ph.estimatedValue', 'estimatedValue')
      .addSelect('ph.currency', 'currency')
      .addSelect('ph.recordedAt', 'recordedAt')
      .where('ph.recordedAt >= :since', { since })
      .orderBy('ph.recordedAt', 'ASC')
      .getRawMany<{
        itemId: string;
        category: string;
        estimatedValue: string | number;
        currency: string;
        recordedAt: string | Date;
      }>();

    return raw.map((row) => ({
      itemId: row.itemId,
      category: row.category,
      estimatedValue: Number(row.estimatedValue),
      currency: row.currency,
      recordedAt: new Date(row.recordedAt),
    }));
  }

  /**
   * Pure aggregation — exposed for testing. For each category: the latest
   * in-window value per item is averaged into `avgValue`; the trend compares
   * the mean of items' earliest in-window values against the mean of their
   * latest values. `percentChange` is null (trend "flat") when no item in the
   * category has more than one snapshot in the window, i.e. there is no movement
   * to measure. Categories are sorted alphabetically for stable output.
   *
   * Rows must be ordered oldest→newest. Time: O(r). Space: O(items).
   */
  static aggregate(rows: TrendRow[]): CategoryTrendsResponse {
    // category -> itemId -> { earliest, latest }
    const byCategory = new Map<
      string,
      Map<string, { earliest: TrendRow; latest: TrendRow }>
    >();

    for (const row of rows) {
      let items = byCategory.get(row.category);
      if (!items) {
        items = new Map();
        byCategory.set(row.category, items);
      }
      const existing = items.get(row.itemId);
      if (!existing) {
        items.set(row.itemId, { earliest: row, latest: row });
      } else {
        // Rows arrive oldest→newest, so earliest is fixed; advance latest.
        existing.latest = row;
      }
    }

    const categories: CategoryTrend[] = [];
    let currency = DEFAULT_CURRENCY;

    for (const [category, items] of byCategory) {
      const entries = Array.from(items.values());
      const sampleSize = entries.length;
      if (sampleSize === 0) {
        continue;
      }

      const avgLatest =
        entries.reduce((sum, e) => sum + e.latest.estimatedValue, 0) / sampleSize;
      const avgEarliest =
        entries.reduce((sum, e) => sum + e.earliest.estimatedValue, 0) / sampleSize;
      const hasMovement = entries.some(
        (e) => e.earliest.recordedAt.getTime() !== e.latest.recordedAt.getTime(),
      );

      let percentChange: number | null = null;
      let trend: TrendDirection = 'flat';
      if (hasMovement && avgEarliest > 0) {
        percentChange = round2(((avgLatest - avgEarliest) / avgEarliest) * 100);
        trend = direction(percentChange);
      }

      // Use the most recent row's currency as representative.
      currency = entries[0].latest.currency || currency;

      categories.push({
        category,
        avgValue: round2(avgLatest),
        trend,
        percentChange,
        sampleSize,
      });
    }

    categories.sort((a, b) => a.category.localeCompare(b.category));

    return { currency, windowDays: CATEGORY_TREND_WINDOW_DAYS, categories };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function direction(percentChange: number): TrendDirection {
  if (Math.abs(percentChange) < FLAT_THRESHOLD_PERCENT) {
    return 'flat';
  }
  return percentChange > 0 ? 'up' : 'down';
}
