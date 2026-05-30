import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PriceHistoryPoint,
  PriceHistoryResponse,
  TrendDirection,
  TrendWindow,
  TrendWindowDays,
  ValuationCondition,
  ValuationRequest,
} from '@dx-aiot/shared';
import { Item } from '../items/entities/item.entity';
import {
  PriceHistory,
  PriceHistorySource,
} from '../items/entities/price-history.entity';
import { MarketValuationService } from './market-valuation.service';

/** Trailing windows over which trend is reported. */
const TREND_WINDOWS: TrendWindowDays[] = [30, 90, 365];
/** Below this absolute % change a window is reported as "flat". */
const FLAT_THRESHOLD_PERCENT = 0.5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CURRENCY = 'USD';

/** A valuation is "stale" once its latest snapshot is older than this. */
export const STALE_VALUATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;
/** Items per batch in the nightly refresh — keeps AI/rate-limit pressure bounded. */
export const VALUATION_REFRESH_BATCH_SIZE = 10;

/** Outcome counters for one batch valuation-refresh run. */
export interface ValuationRefreshSummary {
  /** Total items considered. */
  scanned: number;
  /** Items whose valuation was re-recorded successfully. */
  updated: number;
  /** Items skipped because their valuation was still fresh. */
  skipped: number;
  /** Stale items whose re-valuation failed (snapshot not recorded). */
  errors: number;
}

@Injectable()
export class PriceHistoryService {
  private readonly logger = new Logger(PriceHistoryService.name);

  constructor(
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepository: Repository<PriceHistory>,
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
    private readonly marketValuationService: MarketValuationService,
  ) {}

  /**
   * Record a value snapshot for an item.
   *
   * For `ai`/`market` sources with no explicit value, the estimate is produced
   * by the market-valuation pipeline using the item's category, brand/model
   * (name), condition, and purchase year/price. Recording never throws on a
   * valuation failure — it logs and skips so the caller's primary flow (e.g. a
   * condition update) is never broken by an analytics side-effect.
   *
   * Time: one valuation (O(M) over the comparable corpus) + one insert.
   */
  async recordSnapshot(
    item: Item,
    source: PriceHistorySource,
    options: { estimatedValue?: number; recordedAt?: Date } = {},
  ): Promise<PriceHistory | null> {
    try {
      let estimatedValue = options.estimatedValue;
      let currency = DEFAULT_CURRENCY;

      if (estimatedValue == null) {
        const referenceYear = (options.recordedAt ?? new Date()).getFullYear();
        const valuation = await this.marketValuationService.estimate(
          this.toValuationRequest(item),
          referenceYear,
        );
        estimatedValue = valuation.estimatedValue;
        currency = valuation.currency;
      }

      const snapshot = this.priceHistoryRepository.create({
        itemId: item.id,
        estimatedValue,
        currency,
        source,
        recordedAt: options.recordedAt ?? new Date(),
      });
      return await this.priceHistoryRepository.save(snapshot);
    } catch (err) {
      this.logger.warn(
        `Failed to record price-history snapshot for item ${item.id}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Re-value every item whose latest snapshot is older than 24h (or has none)
   * and record a fresh `ai` snapshot for it. Items are processed in batches of
   * {@link VALUATION_REFRESH_BATCH_SIZE} to bound AI/rate-limit pressure;
   * per-item failures are swallowed by {@link recordSnapshot} and counted as
   * errors so one bad item never aborts the run.
   *
   * Staleness is derived from the latest `price_history.recordedAt` per item —
   * the Item entity carries no `lastValuationAt` column, and the append-only
   * history is the single source of truth, so no schema change is needed. All
   * items are treated as active (the entity has no soft-delete/status flag).
   *
   * Time: O(n) items + one GROUP BY over price_history; valuations run in
   * batches of {@link VALUATION_REFRESH_BATCH_SIZE} concurrently.
   *
   * @param now reference time (injectable for testing).
   */
  async refreshStaleValuations(now: Date = new Date()): Promise<ValuationRefreshSummary> {
    const items = await this.itemsRepository.find();
    const lastValuationByItem = await this.latestValuationTimestamps();
    const cutoff = now.getTime() - STALE_VALUATION_THRESHOLD_MS;

    const stale = items.filter((item) => {
      const last = lastValuationByItem.get(item.id);
      return last == null || last.getTime() < cutoff;
    });

    let updated = 0;
    let errors = 0;

    for (let i = 0; i < stale.length; i += VALUATION_REFRESH_BATCH_SIZE) {
      const batch = stale.slice(i, i + VALUATION_REFRESH_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((item) =>
          this.recordSnapshot(item, PriceHistorySource.AI, { recordedAt: now }),
        ),
      );
      for (const result of results) {
        if (result) {
          updated += 1;
        } else {
          errors += 1;
        }
      }
    }

    const summary: ValuationRefreshSummary = {
      scanned: items.length,
      updated,
      skipped: items.length - stale.length,
      errors,
    };
    this.logger.log(
      `Valuation refresh: scanned=${summary.scanned} updated=${summary.updated} ` +
        `skipped=${summary.skipped} errors=${summary.errors}`,
    );
    return summary;
  }

  /** Latest `recordedAt` per item, via a single GROUP BY over price_history. */
  private async latestValuationTimestamps(): Promise<Map<string, Date>> {
    const rows = await this.priceHistoryRepository
      .createQueryBuilder('ph')
      .select('ph.itemId', 'itemId')
      .addSelect('MAX(ph.recordedAt)', 'lastAt')
      .groupBy('ph.itemId')
      .getRawMany<{ itemId: string; lastAt: string | Date }>();

    const map = new Map<string, Date>();
    for (const row of rows) {
      map.set(row.itemId, new Date(row.lastAt));
    }
    return map;
  }

  /**
   * Return the full value time-series plus trend for an item the caller owns.
   * Throws NotFoundException if the item does not exist or is not owned by the
   * caller (ownership is enforced here so the controller stays thin).
   */
  async getHistory(itemId: string, userId: string): Promise<PriceHistoryResponse> {
    const item = await this.itemsRepository.findOne({ where: { id: itemId, userId } });
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    const rows = await this.priceHistoryRepository.find({
      where: { itemId },
      order: { recordedAt: 'ASC' },
    });

    const points: PriceHistoryPoint[] = rows.map((row) => ({
      id: row.id,
      estimatedValue: Number(row.estimatedValue),
      currency: row.currency,
      source: row.source,
      recordedAt: new Date(row.recordedAt).toISOString(),
    }));

    const currency = points.length
      ? points[points.length - 1].currency
      : DEFAULT_CURRENCY;
    const latestValue = points.length
      ? points[points.length - 1].estimatedValue
      : null;

    return {
      itemId,
      currency,
      points,
      latestValue,
      trends: PriceHistoryService.computeTrends(points),
    };
  }

  /**
   * Compute the trailing-window trend for an ordered (oldest→newest) series.
   *
   * For each window of W days, the baseline ("from") is the value as of the
   * window start (`now - W`): the most recent point recorded at or before the
   * window start. When no point predates the window start, the earliest point
   * in the series is used as the baseline, so a young asset still reports the
   * change since tracking began rather than a null. The latest point is the
   * "to" value. Direction is `flat` when |%| < FLAT_THRESHOLD_PERCENT.
   *
   * Time: O(W_count * n) — a linear scan per window (3 windows ⇒ O(n)).
   * Space: O(1) beyond the output.
   *
   * @param points ordered oldest→newest.
   * @param now reference timestamp in ms (injectable for testing).
   */
  static computeTrends(
    points: PriceHistoryPoint[],
    now: number = Date.now(),
  ): TrendWindow[] {
    if (points.length === 0) {
      return TREND_WINDOWS.map((windowDays) => ({
        windowDays,
        direction: 'flat' as TrendDirection,
        percentChange: null,
        fromValue: null,
        toValue: null,
      }));
    }

    const latest = points[points.length - 1];
    const toValue = latest.estimatedValue;

    return TREND_WINDOWS.map((windowDays) => {
      const windowStart = now - windowDays * MS_PER_DAY;

      // Most recent point at or before the window start; else earliest point.
      let baseline = points[0];
      for (const point of points) {
        if (new Date(point.recordedAt).getTime() <= windowStart) {
          baseline = point;
        } else {
          break;
        }
      }

      const fromValue = baseline.estimatedValue;
      const percentChange = this.percentChange(fromValue, toValue);

      return {
        windowDays,
        direction: this.direction(percentChange),
        percentChange,
        fromValue,
        toValue,
      };
    });
  }

  private static percentChange(from: number, to: number): number | null {
    if (from === 0) {
      // Avoid divide-by-zero; treat any rise from zero as undefined %.
      return to === 0 ? 0 : null;
    }
    return Math.round(((to - from) / from) * 10000) / 100;
  }

  private static direction(percentChange: number | null): TrendDirection {
    if (percentChange == null || Math.abs(percentChange) < FLAT_THRESHOLD_PERCENT) {
      return 'flat';
    }
    return percentChange > 0 ? 'up' : 'down';
  }

  /** Map an Item row onto the valuation engine's request contract. */
  private toValuationRequest(item: Item): ValuationRequest {
    const name = [item.brand, item.model, item.name].filter(Boolean).join(' ').trim();
    return {
      name: name || item.name,
      category: item.category,
      condition: item.condition as ValuationCondition,
      purchaseYear: item.purchaseDate
        ? new Date(item.purchaseDate).getFullYear()
        : undefined,
      purchasePrice:
        item.purchasePrice != null ? Number(item.purchasePrice) : undefined,
    };
  }
}
