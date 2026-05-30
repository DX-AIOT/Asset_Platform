import { Repository } from 'typeorm';
import {
  PriceHistoryService,
  STALE_VALUATION_THRESHOLD_MS,
  VALUATION_REFRESH_BATCH_SIZE,
} from './price-history.service';
import { Item } from '../items/entities/item.entity';
import {
  PriceHistory,
  PriceHistorySource,
} from '../items/entities/price-history.entity';
import { MarketValuationService } from './market-valuation.service';

const NOW = new Date('2026-05-30T03:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const makeItem = (id: string): Item =>
  ({ id, name: `Item ${id}`, category: 'electronics' } as Item);

/**
 * Build a PriceHistoryService with mocked repositories. `lastValuations` maps
 * itemId -> latest recordedAt (omit an item to simulate "never valued").
 */
const makeService = (opts: {
  items: Item[];
  lastValuations: Record<string, Date>;
  failItemIds?: Set<string>;
}) => {
  const latestRows = Object.entries(opts.lastValuations).map(([itemId, lastAt]) => ({
    itemId,
    lastAt,
  }));

  const qb: Record<string, unknown> = {};
  for (const m of ['select', 'addSelect', 'groupBy']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue(latestRows);

  const created: PriceHistory[] = [];
  const priceHistoryRepository = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((data: Partial<PriceHistory>) => {
      const row = { id: `ph-${created.length}`, ...data } as PriceHistory;
      created.push(row);
      return row;
    }),
    save: jest.fn(async (row: PriceHistory) => {
      if (opts.failItemIds?.has(row.itemId)) {
        throw new Error('db down');
      }
      return row;
    }),
  } as unknown as Repository<PriceHistory>;

  const itemsRepository = {
    find: jest.fn().mockResolvedValue(opts.items),
  } as unknown as Repository<Item>;

  const marketValuationService = {
    estimate: jest.fn().mockResolvedValue({ estimatedValue: 999, currency: 'USD' }),
  } as unknown as MarketValuationService;

  const service = new PriceHistoryService(
    priceHistoryRepository,
    itemsRepository,
    marketValuationService,
  );
  return { service, priceHistoryRepository, marketValuationService };
};

describe('PriceHistoryService.refreshStaleValuations', () => {
  it('refreshes only stale items and skips fresh ones', async () => {
    const fresh = makeItem('fresh');
    const stale = makeItem('stale');
    const never = makeItem('never');

    const { service, marketValuationService } = makeService({
      items: [fresh, stale, never],
      lastValuations: {
        fresh: new Date(NOW.getTime() - 1 * HOUR), // within 24h -> skip
        stale: new Date(NOW.getTime() - STALE_VALUATION_THRESHOLD_MS - HOUR), // skip cutoff
        // `never` has no entry -> treated as stale
      },
    });

    const summary = await service.refreshStaleValuations(NOW);

    expect(summary.scanned).toBe(3);
    expect(summary.skipped).toBe(1); // only `fresh`
    expect(summary.updated).toBe(2); // `stale` + `never`
    expect(summary.errors).toBe(0);
    expect(marketValuationService.estimate).toHaveBeenCalledTimes(2);
  });

  it('counts re-valuation failures as errors without aborting the run', async () => {
    const a = makeItem('a');
    const b = makeItem('b');

    const { service } = makeService({
      items: [a, b],
      lastValuations: {}, // both stale
      failItemIds: new Set(['a']),
    });

    const summary = await service.refreshStaleValuations(NOW);

    expect(summary.scanned).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.updated).toBe(1); // b succeeded
    expect(summary.errors).toBe(1); // a failed
  });

  it('records snapshots with the AI source', async () => {
    const a = makeItem('a');
    const { service, priceHistoryRepository } = makeService({
      items: [a],
      lastValuations: {},
    });

    await service.refreshStaleValuations(NOW);

    expect(priceHistoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'a', source: PriceHistorySource.AI }),
    );
  });

  it('processes more than one batch when there are many stale items', async () => {
    const count = VALUATION_REFRESH_BATCH_SIZE * 2 + 3;
    const items = Array.from({ length: count }, (_, i) => makeItem(`i${i}`));

    const { service, marketValuationService } = makeService({
      items,
      lastValuations: {},
    });

    const summary = await service.refreshStaleValuations(NOW);

    expect(summary.scanned).toBe(count);
    expect(summary.updated).toBe(count);
    expect(marketValuationService.estimate).toHaveBeenCalledTimes(count);
  });
});
