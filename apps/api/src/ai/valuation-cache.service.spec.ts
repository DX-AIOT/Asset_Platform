import { ConfigService } from '@nestjs/config';
import {
  ValuationCacheService,
  VALUATION_CACHE_TTL_SECONDS,
} from './valuation-cache.service';
import { ValuationResult } from '@dx-aiot/shared';

const sample: ValuationResult = {
  estimatedValue: 417.22,
  currency: 'USD',
  confidence: 'high',
  comparables: [],
  basis: {
    baselinePrice: 1099,
    ageYears: 3,
    depreciationFactor: 0.4746,
    conditionFactor: 0.8,
    method: 'comparable',
  },
  category: 'mobile_phones',
  cached: false,
};

// No REDIS_URL -> in-memory fallback path.
const makeCache = () =>
  new ValuationCacheService({ get: () => undefined } as unknown as ConfigService);

describe('ValuationCacheService (in-memory fallback)', () => {
  it('returns null on a miss', async () => {
    const cache = makeCache();
    expect(await cache.get('missing')).toBeNull();
  });

  it('stores and retrieves a value within TTL', async () => {
    const cache = makeCache();
    const now = 1_000_000;
    await cache.set('k', sample, VALUATION_CACHE_TTL_SECONDS, now);
    const got = await cache.get('k', now + 1000);
    expect(got).toEqual(sample);
  });

  it('expires entries after the TTL window', async () => {
    const cache = makeCache();
    const now = 1_000_000;
    await cache.set('k', sample, VALUATION_CACHE_TTL_SECONDS, now);
    const afterTtl = now + (VALUATION_CACHE_TTL_SECONDS + 1) * 1000;
    expect(await cache.get('k', afterTtl)).toBeNull();
  });

  it('defaults to a 24h TTL', () => {
    expect(VALUATION_CACHE_TTL_SECONDS).toBe(24 * 60 * 60);
  });
});
