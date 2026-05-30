import { Repository } from 'typeorm';
import {
  MarketTrendsService,
  CATEGORY_TREND_CACHE_TTL_MS,
  CATEGORY_TREND_WINDOW_DAYS,
} from './market-trends.service';
import { PriceHistory } from '../items/entities/price-history.entity';

interface RowInput {
  itemId: string;
  category: string;
  estimatedValue: number;
  currency?: string;
  daysAgo: number;
}

const NOW = new Date('2026-05-30T00:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const row = (r: RowInput) => ({
  itemId: r.itemId,
  category: r.category,
  estimatedValue: r.estimatedValue,
  currency: r.currency ?? 'USD',
  recordedAt: new Date(NOW.getTime() - r.daysAgo * MS_PER_DAY),
});

describe('MarketTrendsService.aggregate', () => {
  it('reports an "up" trend and percent change from earliest to latest', () => {
    // Two items in electronics, each rising 10% over the window.
    const result = MarketTrendsService.aggregate([
      row({ itemId: 'a', category: 'electronics', estimatedValue: 1000, daysAgo: 25 }),
      row({ itemId: 'a', category: 'electronics', estimatedValue: 1100, daysAgo: 1 }),
      row({ itemId: 'b', category: 'electronics', estimatedValue: 2000, daysAgo: 25 }),
      row({ itemId: 'b', category: 'electronics', estimatedValue: 2200, daysAgo: 1 }),
    ]);

    expect(result.windowDays).toBe(CATEGORY_TREND_WINDOW_DAYS);
    expect(result.categories).toHaveLength(1);
    const electronics = result.categories[0];
    expect(electronics.category).toBe('electronics');
    expect(electronics.sampleSize).toBe(2);
    // avg latest = (1100 + 2200) / 2 = 1650
    expect(electronics.avgValue).toBe(1650);
    // avg earliest = 1500 -> (1650-1500)/1500 = 10%
    expect(electronics.percentChange).toBe(10);
    expect(electronics.trend).toBe('up');
  });

  it('reports a "down" trend for declining values', () => {
    const result = MarketTrendsService.aggregate([
      row({ itemId: 'a', category: 'laptops', estimatedValue: 2000, daysAgo: 20 }),
      row({ itemId: 'a', category: 'laptops', estimatedValue: 1800, daysAgo: 2 }),
    ]);
    const laptops = result.categories[0];
    expect(laptops.percentChange).toBe(-10);
    expect(laptops.trend).toBe('down');
  });

  it('returns null percentChange and flat trend when items have a single snapshot', () => {
    const result = MarketTrendsService.aggregate([
      row({ itemId: 'a', category: 'furniture', estimatedValue: 500, daysAgo: 3 }),
      row({ itemId: 'b', category: 'furniture', estimatedValue: 700, daysAgo: 5 }),
    ]);
    const furniture = result.categories[0];
    expect(furniture.sampleSize).toBe(2);
    expect(furniture.avgValue).toBe(600);
    expect(furniture.percentChange).toBeNull();
    expect(furniture.trend).toBe('flat');
  });

  it('reports flat when the change is below the flat threshold', () => {
    const result = MarketTrendsService.aggregate([
      row({ itemId: 'a', category: 'vehicles', estimatedValue: 10000, daysAgo: 20 }),
      row({ itemId: 'a', category: 'vehicles', estimatedValue: 10020, daysAgo: 1 }), // +0.2%
    ]);
    const vehicles = result.categories[0];
    expect(vehicles.trend).toBe('flat');
    expect(vehicles.percentChange).toBe(0.2);
  });

  it('aggregates multiple categories sorted alphabetically', () => {
    const result = MarketTrendsService.aggregate([
      row({ itemId: 'x', category: 'mobile_phones', estimatedValue: 800, daysAgo: 1 }),
      row({ itemId: 'y', category: 'appliances', estimatedValue: 300, daysAgo: 1 }),
    ]);
    expect(result.categories.map((c) => c.category)).toEqual([
      'appliances',
      'mobile_phones',
    ]);
  });

  it('returns an empty list when there is no history', () => {
    const result = MarketTrendsService.aggregate([]);
    expect(result.categories).toEqual([]);
    expect(result.windowDays).toBe(CATEGORY_TREND_WINDOW_DAYS);
  });
});

describe('MarketTrendsService.getCategoryTrends caching', () => {
  const makeRepo = (rows: unknown[]) => {
    const getRawMany = jest.fn().mockResolvedValue(rows);
    const qb: Record<string, unknown> = {};
    for (const m of ['innerJoin', 'select', 'addSelect', 'where', 'orderBy']) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getRawMany = getRawMany;
    const createQueryBuilder = jest.fn(() => qb);
    return {
      repo: { createQueryBuilder } as unknown as Repository<PriceHistory>,
      getRawMany,
    };
  };

  it('caches the response for 6h and recomputes after TTL', async () => {
    const dbRows = [
      {
        itemId: 'a',
        category: 'electronics',
        estimatedValue: '1000',
        currency: 'USD',
        recordedAt: new Date(NOW.getTime() - 2 * MS_PER_DAY).toISOString(),
      },
    ];
    const { repo, getRawMany } = makeRepo(dbRows);
    const service = new MarketTrendsService(repo);

    await service.getCategoryTrends(NOW);
    await service.getCategoryTrends(new Date(NOW.getTime() + CATEGORY_TREND_CACHE_TTL_MS - 1));
    expect(getRawMany).toHaveBeenCalledTimes(1); // served from cache

    await service.getCategoryTrends(new Date(NOW.getTime() + CATEGORY_TREND_CACHE_TTL_MS + 1));
    expect(getRawMany).toHaveBeenCalledTimes(2); // TTL expired -> recompute
  });

  it('invalidate() forces a recompute', async () => {
    const { repo, getRawMany } = makeRepo([]);
    const service = new MarketTrendsService(repo);
    await service.getCategoryTrends(NOW);
    service.invalidate();
    await service.getCategoryTrends(NOW);
    expect(getRawMany).toHaveBeenCalledTimes(2);
  });
});
