import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  ListingSuggestionService,
  SELLER_PREMIUM_BY_CONFIDENCE,
} from '../src/ai/listing-suggestion.service';
import { ListingSuggestionCacheService } from '../src/ai/listing-suggestion-cache.service';
import { MarketValuationService } from '../src/ai/market-valuation.service';
import { Item, ItemCategory, ItemCondition } from '../src/items/entities/item.entity';
import { ValuationResult } from '@dx-aiot/shared';

const RATE = 25000; // 1 USD = 25,000 VND for deterministic assertions.

function buildService(overrides?: {
  item?: Partial<Item> | null;
  valuation?: Partial<ValuationResult>;
  config?: Record<string, string>;
}) {
  const config = {
    OPENAI_LOCAL_MODE: 'true',
    USD_TO_VND_RATE: String(RATE),
    ...(overrides?.config ?? {}),
  };
  const configService = {
    get: (key: string) => config[key],
  } as unknown as ConfigService;

  const item =
    overrides?.item === null
      ? null
      : ({
          id: 'item-1',
          name: 'iPhone 14 Pro Max',
          brand: 'Apple',
          model: '',
          category: ItemCategory.MOBILE_PHONES,
          condition: ItemCondition.GOOD,
          purchaseDate: new Date('2023-01-15T00:00:00.000Z'),
          purchasePrice: 28500000, // VND
          location: 'Ho Chi Minh City',
          photos: ['https://cdn/p1.jpg', 'https://cdn/p2.jpg'],
          notes: 'Battery health 92%.',
          ...(overrides?.item ?? {}),
        } as Item);

  const itemsRepository = {
    findOne: jest.fn().mockResolvedValue(item),
  } as unknown as Repository<Item>;

  const valuationResult: ValuationResult = {
    estimatedValue: 44, // USD → 1,100,000 VND at RATE
    currency: 'USD',
    confidence: 'high',
    comparables: [
      { source: 'market-reference', title: 'iPhone 14 Pro', price: 1099, currency: 'USD', matchScore: 0.8 },
    ],
    basis: {
      baselinePrice: 1099,
      ageYears: 3,
      depreciationFactor: 0.5,
      conditionFactor: 0.8,
      method: 'comparable',
    },
    category: 'mobile_phones',
    cached: false,
    ...(overrides?.valuation ?? {}),
  };

  const valuationService = {
    estimate: jest.fn().mockResolvedValue(valuationResult),
  } as unknown as MarketValuationService;

  const cache = new ListingSuggestionCacheService(configService);

  const service = new ListingSuggestionService(configService, itemsRepository, valuationService, cache);
  return { service, itemsRepository, valuationService, cache };
}

describe('ListingSuggestionService — price suggestion', () => {
  describe('computePrice premium logic', () => {
    it('applies an 8% seller premium for high confidence', () => {
      const { service } = buildService();
      const result = service.computePrice(44, 'high', 1);

      expect(result.estimatedMarketValue).toBe(1_100_000);
      // 1,100,000 * 1.08 = 1,188,000 → rounded to nearest 10k = 1,190,000
      expect(result.suggestedPrice).toBe(1_190_000);
      expect(result.suggestedPrice).toBeGreaterThan(result.estimatedMarketValue);
      expect(result.currency).toBe('VND');
    });

    it('applies no premium for low confidence', () => {
      const { service } = buildService();
      const result = service.computePrice(44, 'low', 0);

      expect(result.suggestedPrice).toBe(result.estimatedMarketValue);
      expect(SELLER_PREMIUM_BY_CONFIDENCE.low).toBe(0);
    });

    it('orders the negotiation band low < estimate < high', () => {
      const { service } = buildService();
      for (const confidence of ['high', 'medium', 'low'] as const) {
        const r = service.computePrice(44, confidence, 2);
        expect(r.priceRange.low).toBeLessThan(r.estimatedMarketValue);
        expect(r.priceRange.high).toBeGreaterThan(r.estimatedMarketValue);
      }
    });

    it('keeps the premium within the 5–10% spec band for high confidence', () => {
      expect(SELLER_PREMIUM_BY_CONFIDENCE.high).toBeGreaterThanOrEqual(0.05);
      expect(SELLER_PREMIUM_BY_CONFIDENCE.high).toBeLessThanOrEqual(0.1);
    });

    it('cites the comparable count in the rationale when comparables exist', () => {
      const { service } = buildService();
      expect(service.computePrice(44, 'high', 12).rationale).toContain('12 comparable listings');
      expect(service.computePrice(44, 'high', 1).rationale).toContain('1 comparable listing');
    });
  });

  describe('suggestPrice end-to-end (mocked deps)', () => {
    it('values the item and converts the USD purchase price to a USD anchor', async () => {
      const { service, valuationService } = buildService();
      await service.suggestPrice({ itemId: 'item-1' }, 2026);

      const req = (valuationService.estimate as jest.Mock).mock.calls[0][0];
      expect(req.currency).toBe('USD');
      // 28,500,000 VND / 25,000 = 1,140 USD
      expect(req.purchasePrice).toBeCloseTo(1140, 5);
      expect(req.purchaseYear).toBe(2023);
      expect(req.condition).toBe('good');
    });

    it('caches the result and serves the second call from cache', async () => {
      const { service, valuationService } = buildService();
      const first = await service.suggestPrice({ itemId: 'item-1' }, 2026);
      const second = await service.suggestPrice({ itemId: 'item-1' }, 2026);

      expect(first.cached).toBe(false);
      expect(second.cached).toBe(true);
      // Valuation only computed once — second served from cache.
      expect(valuationService.estimate).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for a missing item', async () => {
      const { service } = buildService({ item: null });
      await expect(service.suggestPrice({ itemId: 'missing' }, 2026)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

describe('ListingSuggestionService — autofill', () => {
  it('builds a coherent draft from item data (local mock description)', async () => {
    const { service } = buildService();
    const draft = await service.autofill('item-1');

    expect(draft.title).toBe('iPhone 14 Pro Max'); // brand already in name → not duplicated
    expect(draft.category).toBe('mobile_phones');
    expect(draft.condition).toBe('good');
    expect(draft.photos).toEqual(['https://cdn/p1.jpg', 'https://cdn/p2.jpg']);
    expect(draft.location).toEqual({ city: 'Ho Chi Minh City' });
    expect(draft.description).toContain('good condition');
    expect(draft.description).toContain('2023');
    expect(draft.description).toContain('Battery health 92%.');
  });

  it('falls back to brand/model for the title when the name is blank', async () => {
    const { service } = buildService({
      item: { name: '', brand: 'Apple', model: 'A2895' },
    });
    const draft = await service.autofill('item-1');
    expect(draft.title).toBe('Apple A2895');
  });

  it('returns null city and empty photos when absent', async () => {
    const { service } = buildService({
      item: { location: '', photos: undefined as unknown as string[], notes: '' },
    });
    const draft = await service.autofill('item-1');
    expect(draft.location).toEqual({ city: null });
    expect(draft.photos).toEqual([]);
  });

  it('throws NotFoundException for a missing item', async () => {
    const { service } = buildService({ item: null });
    await expect(service.autofill('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
