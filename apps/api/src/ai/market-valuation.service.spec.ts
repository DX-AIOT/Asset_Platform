import { MarketValuationService } from './market-valuation.service';
import { ValuationCacheService } from './valuation-cache.service';

const REFERENCE_YEAR = 2026;

const makeCache = () =>
  // No REDIS_URL -> ValuationCacheService uses its in-memory TTL map.
  new ValuationCacheService({ get: () => undefined } as never);

const makeService = () => new MarketValuationService(makeCache());

describe('MarketValuationService', () => {
  it('returns a high-confidence estimate for a strong comparable match', () => {
    const service = makeService();
    const result = service.compute(
      { name: 'iPhone 14 Pro', category: 'mobile_phones', condition: 'good', purchaseYear: 2023 },
      REFERENCE_YEAR,
    );

    expect(result.confidence).toBe('high');
    expect(result.category).toBe('mobile_phones');
    expect(result.basis.method).toBe('comparable');
    expect(result.basis.baselinePrice).toBe(1099);
    // 3 years of depreciation + good condition -> well below baseline, above zero.
    expect(result.estimatedValue).toBeGreaterThan(0);
    expect(result.estimatedValue).toBeLessThan(1099);
    expect(result.comparables[0].title).toContain('iPhone 14 Pro');
  });

  it('depreciates value with asset age', () => {
    const service = makeService();
    const newer = service.compute(
      { name: 'MacBook Pro 16', category: 'laptops', condition: 'good', purchaseYear: 2025 },
      REFERENCE_YEAR,
    );
    const older = service.compute(
      { name: 'MacBook Pro 16', category: 'laptops', condition: 'good', purchaseYear: 2019 },
      REFERENCE_YEAR,
    );

    expect(newer.estimatedValue).toBeGreaterThan(older.estimatedValue);
    expect(older.basis.depreciationFactor).toBeLessThan(newer.basis.depreciationFactor);
  });

  it('values better condition higher than worse condition', () => {
    const service = makeService();
    const base = { name: 'Honda Wave Alpha 110', category: 'vehicles', purchaseYear: 2022 } as const;
    const likeNew = service.compute({ ...base, condition: 'like_new' }, REFERENCE_YEAR);
    const poor = service.compute({ ...base, condition: 'poor' }, REFERENCE_YEAR);

    expect(likeNew.estimatedValue).toBeGreaterThan(poor.estimatedValue);
  });

  it('falls back to low confidence for unsupported categories but still estimates', () => {
    const service = makeService();
    const result = service.compute(
      { name: 'Antique Spaceship', category: 'spaceship', condition: 'good', purchaseYear: 2020 },
      REFERENCE_YEAR,
    );

    expect(result.confidence).toBe('low');
    expect(result.category).toBe('other');
    expect(result.estimatedValue).toBeGreaterThan(0);
  });

  it('anchors on purchase price when the name does not match any comparable', () => {
    const service = makeService();
    const result = service.compute(
      {
        name: 'Obscure Off-Brand Gadget XYZ',
        category: 'electronics',
        condition: 'good',
        purchaseYear: 2024,
        purchasePrice: 500,
      },
      REFERENCE_YEAR,
    );

    expect(result.basis.method).toBe('purchase_price');
    expect(result.basis.baselinePrice).toBe(500);
    expect(result.confidence).toBe('medium');
  });

  it('uses category median when no comparable and no purchase price are available', () => {
    const service = makeService();
    const result = service.compute(
      { name: 'Unknown Device 9000', category: 'appliances', condition: 'good', purchaseYear: 2024 },
      REFERENCE_YEAR,
    );

    expect(result.basis.method).toBe('category_median');
    expect(result.confidence).toBe('low');
    expect(result.estimatedValue).toBeGreaterThan(0);
  });

  it('does not depreciate brand-new (current-year) assets', () => {
    const service = makeService();
    const result = service.compute(
      { name: 'iPad Pro 11', category: 'tablets', condition: 'new', purchaseYear: REFERENCE_YEAR },
      REFERENCE_YEAR,
    );

    expect(result.basis.ageYears).toBe(0);
    expect(result.basis.depreciationFactor).toBe(1);
    expect(result.basis.conditionFactor).toBe(1);
    expect(result.estimatedValue).toBe(result.basis.baselinePrice);
  });

  it('handles missing purchase year (age 0) gracefully', () => {
    const service = makeService();
    const result = service.compute(
      { name: 'Dell XPS 13', category: 'laptops', condition: 'good' },
      REFERENCE_YEAR,
    );

    expect(result.basis.ageYears).toBe(0);
    expect(result.estimatedValue).toBeGreaterThan(0);
  });

  it('caches results and reports cached=true on the second call', async () => {
    const service = makeService();
    const request = {
      name: 'iPhone 14 Pro',
      category: 'mobile_phones',
      condition: 'good',
      purchaseYear: 2023,
    } as const;

    const first = await service.estimate(request, REFERENCE_YEAR);
    const second = await service.estimate(request, REFERENCE_YEAR);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.estimatedValue).toBe(first.estimatedValue);
  });

  it('responds well within the 5s budget for supported categories', async () => {
    const service = makeService();
    const start = Date.now();
    await service.estimate(
      { name: 'Samsung Galaxy S23', category: 'mobile_phones', condition: 'good', purchaseYear: 2023 },
      REFERENCE_YEAR,
    );
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('produces a valuation for every seed-database asset (>=80% coverage)', () => {
    const service = makeService();
    // Mirrors apps/api/src/database/database-seed.service.ts seed items.
    const seedAssets = [
      { name: 'iPhone 14 Pro', category: 'mobile_phones', condition: 'like_new', purchaseYear: 2023 },
      { name: 'MacBook Pro 16"', category: 'laptops', condition: 'good', purchaseYear: 2023 },
      { name: 'Honda Wave Alpha 110', category: 'vehicles', condition: 'good', purchaseYear: 2022 },
    ] as const;

    const valued = seedAssets.filter((asset) => {
      const result = service.compute(asset, REFERENCE_YEAR);
      return Number.isFinite(result.estimatedValue) && result.estimatedValue > 0;
    });

    expect(valued.length / seedAssets.length).toBeGreaterThanOrEqual(0.8);
  });
});
