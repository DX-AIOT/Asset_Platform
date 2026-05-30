import { Injectable } from '@nestjs/common';
import {
  ValuationBasis,
  ValuationComparable,
  ValuationConfidence,
  ValuationRequest,
  ValuationResult,
} from '@dx-aiot/shared';
import {
  CATEGORY_MEDIAN_BASELINE,
  CONDITION_FACTORS,
  DEFAULT_CONDITION,
  DEPRECIATION_PROFILES,
  FALLBACK_DEPRECIATION,
  MARKET_COMPARABLES,
  MarketComparable,
  normalizeCategory,
} from './market-data';
import { ValuationCacheService } from './valuation-cache.service';

/** Match score at/above which a comparable is trusted as the baseline. */
const STRONG_MATCH_THRESHOLD = 0.34;
/** Match score below which a comparable is too weak to anchor the estimate. */
const WEAK_MATCH_THRESHOLD = 0.12;
const DEFAULT_CURRENCY = 'USD';

@Injectable()
export class MarketValuationService {
  constructor(private readonly cache: ValuationCacheService) {}

  /**
   * Estimate the current market value of an asset.
   *
   * Time complexity: O(M * (Tq + Tc)) where M = number of seeded comparables,
   * Tq/Tc = token counts of the query and a comparable's keyword list — i.e.
   * linear in the corpus size. Space: O(Tq) for the tokenized query.
   * Result is cached for 24h keyed by the normalized request.
   */
  async estimate(request: ValuationRequest, referenceYear: number): Promise<ValuationResult> {
    const cacheKey = this.buildCacheKey(request);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = this.compute(request, referenceYear);
    await this.cache.set(cacheKey, result);
    return result;
  }

  /** Pure valuation computation (no cache) — exposed for testing. */
  compute(request: ValuationRequest, referenceYear: number): ValuationResult {
    const category = normalizeCategory(request.category);
    const condition = request.condition ?? DEFAULT_CONDITION;
    const conditionFactor = CONDITION_FACTORS[condition] ?? CONDITION_FACTORS[DEFAULT_CONDITION];
    const currency = (request.currency ?? DEFAULT_CURRENCY).toUpperCase();
    const ageYears = this.computeAge(request.purchaseYear, referenceYear);

    const profile = category ? DEPRECIATION_PROFILES[category] : FALLBACK_DEPRECIATION;
    const depreciationFactor = this.depreciation(profile.annualRate, profile.floor, ageYears);

    // 1. Find the best comparable within the (normalized) category.
    const { best, comparables } = this.findComparables(request.name, category);

    let baselinePrice: number;
    let method: ValuationBasis['method'];
    let confidence: ValuationConfidence;

    if (category && best && best.matchScore >= WEAK_MATCH_THRESHOLD) {
      baselinePrice = best.basePrice;
      method = 'comparable';
      confidence = best.matchScore >= STRONG_MATCH_THRESHOLD ? 'high' : 'medium';
    } else if (request.purchasePrice && request.purchasePrice > 0) {
      // Anchor on the original purchase price (treated as the "new" baseline).
      baselinePrice = request.purchasePrice;
      method = 'purchase_price';
      confidence = category ? 'medium' : 'low';
    } else if (category) {
      baselinePrice = CATEGORY_MEDIAN_BASELINE[category];
      method = 'category_median';
      confidence = 'low';
    } else {
      // Unsupported category, no anchor: coarse fallback estimate.
      baselinePrice = this.globalMedianBaseline();
      method = 'category_median';
      confidence = 'low';
    }

    const estimatedValue = this.round2(baselinePrice * depreciationFactor * conditionFactor);

    const basis: ValuationBasis = {
      baselinePrice: this.round2(baselinePrice),
      ageYears,
      depreciationFactor: this.round4(depreciationFactor),
      conditionFactor,
      method,
    };

    return {
      estimatedValue,
      currency,
      confidence,
      comparables,
      basis,
      category: category ?? 'other',
      cached: false,
    };
  }

  private findComparables(
    name: string,
    category: ReturnType<typeof normalizeCategory>,
  ): { best: { comparable: MarketComparable; matchScore: number; basePrice: number } | null; comparables: ValuationComparable[] } {
    const queryTokens = this.tokenize(name);
    const pool = category
      ? MARKET_COMPARABLES.filter((c) => c.category === category)
      : MARKET_COMPARABLES;

    const scored = pool
      .map((comparable) => ({
        comparable,
        matchScore: this.matchScore(queryTokens, comparable.keywords),
        basePrice: comparable.basePrice,
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    const best = scored.length > 0 && scored[0].matchScore > 0 ? scored[0] : null;

    // Surface up to 3 comparables as supporting evidence.
    const comparables: ValuationComparable[] = scored
      .filter((row) => row.matchScore > 0)
      .slice(0, 3)
      .map((row) => ({
        source: 'market-reference',
        title: row.comparable.title,
        price: row.comparable.basePrice,
        currency: DEFAULT_CURRENCY,
        matchScore: this.round2(row.matchScore),
      }));

    return { best, comparables };
  }

  /**
   * Asymmetric token overlap: fraction of comparable keywords present in the
   * query, blended with fraction of query tokens matched. Favors comparables
   * whose distinctive keywords ("iphone", "14", "pro") appear in the name.
   */
  private matchScore(queryTokens: Set<string>, keywords: string[]): number {
    if (queryTokens.size === 0 || keywords.length === 0) {
      return 0;
    }
    let hits = 0;
    for (const keyword of keywords) {
      if (queryTokens.has(keyword)) {
        hits += 1;
      }
    }
    if (hits === 0) {
      return 0;
    }
    const keywordCoverage = hits / keywords.length;
    const queryCoverage = hits / queryTokens.size;
    return keywordCoverage * 0.6 + queryCoverage * 0.4;
  }

  private tokenize(input: string | undefined): Set<string> {
    if (!input) {
      return new Set();
    }
    const normalized = input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return new Set(normalized.split(' ').filter((token) => token.length > 0));
  }

  private depreciation(annualRate: number, floor: number, ageYears: number): number {
    if (ageYears <= 0) {
      return 1;
    }
    const residual = Math.pow(1 - annualRate, ageYears);
    return Math.max(floor, residual);
  }

  private computeAge(purchaseYear: number | undefined, referenceYear: number): number {
    if (!purchaseYear || !Number.isFinite(purchaseYear)) {
      return 0;
    }
    const age = referenceYear - purchaseYear;
    if (age < 0) {
      return 0;
    }
    // Cap at 40y to keep depreciation well-defined for ancient/invalid inputs.
    return Math.min(age, 40);
  }

  private globalMedianBaseline(): number {
    const values = Object.values(CATEGORY_MEDIAN_BASELINE).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  }

  private buildCacheKey(request: ValuationRequest): string {
    const name = (request.name ?? '').trim().toLowerCase();
    const category = (request.category ?? '').trim().toLowerCase();
    const condition = request.condition ?? DEFAULT_CONDITION;
    const year = request.purchaseYear ?? 'na';
    const price = request.purchasePrice ?? 'na';
    const currency = (request.currency ?? DEFAULT_CURRENCY).toLowerCase();
    return [name, category, condition, year, price, currency].join('|');
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private round4(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
