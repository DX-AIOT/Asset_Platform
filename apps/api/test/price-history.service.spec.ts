import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PriceHistoryService } from '../src/ai/price-history.service';
import { MarketValuationService } from '../src/ai/market-valuation.service';
import { Item, ItemCategory, ItemCondition } from '../src/items/entities/item.entity';
import { PriceHistory, PriceHistorySource } from '../src/items/entities/price-history.entity';
import type { PriceHistoryPoint } from '@dx-aiot/shared';

const NOW = Date.UTC(2026, 4, 29); // 2026-05-29
const DAY = 24 * 60 * 60 * 1000;

const point = (
  daysAgo: number,
  estimatedValue: number,
  overrides: Partial<PriceHistoryPoint> = {},
): PriceHistoryPoint => ({
  id: `p-${daysAgo}`,
  estimatedValue,
  currency: 'USD',
  source: 'ai',
  recordedAt: new Date(NOW - daysAgo * DAY).toISOString(),
  ...overrides,
});

describe('PriceHistoryService.computeTrends', () => {
  it('returns flat/null windows for an empty series', () => {
    const trends = PriceHistoryService.computeTrends([], NOW);
    expect(trends.map((t) => t.windowDays)).toEqual([30, 90, 365]);
    for (const t of trends) {
      expect(t.direction).toBe('flat');
      expect(t.percentChange).toBeNull();
      expect(t.fromValue).toBeNull();
      expect(t.toValue).toBeNull();
    }
  });

  it('reports flat with 0% when there is only one point', () => {
    const trends = PriceHistoryService.computeTrends([point(0, 1000)], NOW);
    for (const t of trends) {
      expect(t.direction).toBe('flat');
      expect(t.percentChange).toBe(0);
      expect(t.fromValue).toBe(1000);
      expect(t.toValue).toBe(1000);
    }
  });

  it('computes a downward trend using the window-start baseline', () => {
    // 400d ago: 2000, 60d ago: 1200, today: 1000.
    const points = [point(400, 2000), point(60, 1200), point(0, 1000)];
    const [w30, w90, w365] = PriceHistoryService.computeTrends(points, NOW);

    // 30d window: no point at/before 30d-ago start -> earliest within scan is
    // the 60d-ago point (most recent at/before the cutoff) = 1200 baseline.
    expect(w30.fromValue).toBe(1200);
    expect(w30.toValue).toBe(1000);
    expect(w30.percentChange).toBeCloseTo(-16.67, 1);
    expect(w30.direction).toBe('down');

    // 90d window: most recent point at/before 90d-ago is the 400d point = 2000.
    expect(w90.fromValue).toBe(2000);
    expect(w90.percentChange).toBe(-50);
    expect(w90.direction).toBe('down');

    // 365d window: no point predates 365d ago -> earliest point (2000) used.
    expect(w365.fromValue).toBe(2000);
    expect(w365.direction).toBe('down');
  });

  it('reports an upward trend when value rises', () => {
    const points = [point(200, 800), point(0, 1000)];
    const [, , w365] = PriceHistoryService.computeTrends(points, NOW);
    expect(w365.fromValue).toBe(800);
    expect(w365.toValue).toBe(1000);
    expect(w365.percentChange).toBe(25);
    expect(w365.direction).toBe('up');
  });

  it('treats sub-threshold movement as flat', () => {
    const points = [point(40, 1000), point(0, 1003)]; // +0.3%
    const [, w90] = PriceHistoryService.computeTrends(points, NOW);
    expect(w90.percentChange).toBeCloseTo(0.3, 1);
    expect(w90.direction).toBe('flat');
  });
});

describe('PriceHistoryService.getHistory', () => {
  const makeService = (
    itemRepo: Partial<Repository<Item>>,
    historyRepo: Partial<Repository<PriceHistory>>,
  ) =>
    new PriceHistoryService(
      historyRepo as Repository<PriceHistory>,
      itemRepo as Repository<Item>,
      {} as MarketValuationService,
    );

  it('throws NotFound when the item is not owned by the caller', async () => {
    const service = makeService(
      { findOne: jest.fn().mockResolvedValue(null) },
      { find: jest.fn() },
    );
    await expect(service.getHistory('item-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps rows to points and derives latestValue + currency', async () => {
    const rows: Partial<PriceHistory>[] = [
      {
        id: 'a',
        itemId: 'item-1',
        estimatedValue: 1200 as unknown as number,
        currency: 'USD',
        source: PriceHistorySource.AI,
        recordedAt: new Date(NOW - 60 * DAY),
      },
      {
        id: 'b',
        itemId: 'item-1',
        estimatedValue: 1000 as unknown as number,
        currency: 'USD',
        source: PriceHistorySource.AI,
        recordedAt: new Date(NOW),
      },
    ];
    const service = makeService(
      { findOne: jest.fn().mockResolvedValue({ id: 'item-1' }) },
      { find: jest.fn().mockResolvedValue(rows) },
    );

    const res = await service.getHistory('item-1', 'user-1');
    expect(res.itemId).toBe('item-1');
    expect(res.currency).toBe('USD');
    expect(res.points).toHaveLength(2);
    expect(res.latestValue).toBe(1000);
    expect(res.trends).toHaveLength(3);
  });

  it('returns an empty series with null latestValue when no history exists', async () => {
    const service = makeService(
      { findOne: jest.fn().mockResolvedValue({ id: 'item-1' }) },
      { find: jest.fn().mockResolvedValue([]) },
    );
    const res = await service.getHistory('item-1', 'user-1');
    expect(res.points).toEqual([]);
    expect(res.latestValue).toBeNull();
    expect(res.currency).toBe('USD');
  });
});

describe('PriceHistoryService.recordSnapshot', () => {
  const item = {
    id: 'item-1',
    name: 'iPhone 14 Pro',
    brand: 'Apple',
    model: 'A2890',
    category: ItemCategory.MOBILE_PHONES,
    condition: ItemCondition.GOOD,
    purchaseDate: new Date('2023-09-20'),
    purchasePrice: 1199 as unknown as number,
  } as Item;

  it('valuates via the market service and persists a snapshot', async () => {
    const saved = { id: 's1' } as PriceHistory;
    const historyRepo = {
      create: jest.fn((x) => x as PriceHistory),
      save: jest.fn().mockResolvedValue(saved),
    };
    const valuation = {
      estimate: jest.fn().mockResolvedValue({ estimatedValue: 980, currency: 'USD' }),
    };
    const service = new PriceHistoryService(
      historyRepo as unknown as Repository<PriceHistory>,
      {} as Repository<Item>,
      valuation as unknown as MarketValuationService,
    );

    const result = await service.recordSnapshot(item, PriceHistorySource.AI);
    expect(valuation.estimate).toHaveBeenCalled();
    const savedArg = historyRepo.save.mock.calls[0][0];
    expect(savedArg.estimatedValue).toBe(980);
    expect(savedArg.source).toBe(PriceHistorySource.AI);
    expect(result).toBe(saved);
  });

  it('uses an explicit value without calling the valuation service', async () => {
    const historyRepo = {
      create: jest.fn((x) => x as PriceHistory),
      save: jest.fn().mockResolvedValue({ id: 's2' } as PriceHistory),
    };
    const valuation = { estimate: jest.fn() };
    const service = new PriceHistoryService(
      historyRepo as unknown as Repository<PriceHistory>,
      {} as Repository<Item>,
      valuation as unknown as MarketValuationService,
    );

    await service.recordSnapshot(item, PriceHistorySource.MANUAL, { estimatedValue: 500 });
    expect(valuation.estimate).not.toHaveBeenCalled();
    expect(historyRepo.save.mock.calls[0][0].estimatedValue).toBe(500);
  });

  it('never throws when valuation fails — returns null', async () => {
    const historyRepo = { create: jest.fn(), save: jest.fn() };
    const valuation = { estimate: jest.fn().mockRejectedValue(new Error('boom')) };
    const service = new PriceHistoryService(
      historyRepo as unknown as Repository<PriceHistory>,
      {} as Repository<Item>,
      valuation as unknown as MarketValuationService,
    );

    await expect(service.recordSnapshot(item, PriceHistorySource.AI)).resolves.toBeNull();
    expect(historyRepo.save).not.toHaveBeenCalled();
  });
});
