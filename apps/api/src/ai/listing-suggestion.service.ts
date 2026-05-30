import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import {
  ListingAutofillDraft,
  ListingPriceSuggestion,
  ListingPriceSuggestRequest,
  ValuationConfidence,
  ValuationCondition,
  ValuationRequest,
} from '@dx-aiot/shared';
import { Item } from '../items/entities/item.entity';
import { MarketValuationService } from './market-valuation.service';
import { ListingSuggestionCacheService } from './listing-suggestion-cache.service';
import { DEFAULT_USD_TO_VND_RATE, usdToVnd, vndToUsd, roundVnd } from './currency';

/** Listing currency for the marketplace (Vietnam). */
const LISTING_CURRENCY = 'VND';

/**
 * Seller premium applied on top of the estimated resale value, keyed by
 * valuation confidence. Higher confidence → we can defend a higher ask.
 * Spec (DXS-145): 5–10% for high confidence, 0% for low.
 */
export const SELLER_PREMIUM_BY_CONFIDENCE: Record<ValuationConfidence, number> = {
  high: 0.08,
  medium: 0.04,
  low: 0,
};

/**
 * Negotiation-band half-width around the estimate, keyed by confidence.
 * Lower confidence → wider band.
 */
export const PRICE_RANGE_SPREAD_BY_CONFIDENCE: Record<ValuationConfidence, number> = {
  high: 0.15,
  medium: 0.22,
  low: 0.3,
};

const DESCRIPTION_SYSTEM_PROMPT =
  'You are a marketplace listing assistant. Write a brief, factual product description ' +
  'for a second-hand listing using ONLY the asset facts provided. Do not invent specifications, ' +
  'features, or selling points that are not given. Keep it under 60 words, neutral and honest. ' +
  'Mention the condition and, if provided, the approximate purchase year and any owner notes. ' +
  'Return plain text only.';

@Injectable()
export class ListingSuggestionService {
  private readonly logger = new Logger(ListingSuggestionService.name);
  private readonly openai: OpenAI | null;
  private readonly useLocalMock: boolean;
  private readonly usdToVndRate: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
    private readonly valuationService: MarketValuationService,
    private readonly cache: ListingSuggestionCacheService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    const localMode = this.getBooleanConfig('OPENAI_LOCAL_MODE', !apiKey);
    this.useLocalMock = localMode || !apiKey;
    this.openai = this.useLocalMock ? null : new OpenAI({ apiKey, baseURL });
    this.usdToVndRate = this.getNumberConfig('USD_TO_VND_RATE', DEFAULT_USD_TO_VND_RATE);
  }

  // ---------------------------------------------------------------------------
  // Deliverable 1: suggested listing price
  // ---------------------------------------------------------------------------

  /**
   * Suggest a listing price for an item by valuing it (DXS-62 engine) and
   * applying a confidence-scaled seller premium. Result is cached 24h by
   * itemId+condition.
   *
   * Time: dominated by the valuation engine (linear in the comparable corpus);
   * everything else is O(1). Space: O(1).
   */
  async suggestPrice(
    request: ListingPriceSuggestRequest,
    referenceYear: number,
  ): Promise<ListingPriceSuggestion> {
    const item = await this.requireItem(request.itemId);
    const condition = (request.condition ?? this.toValuationCondition(item.condition)) as ValuationCondition;

    const cacheKey = this.cache.buildKey(item.id, condition);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const valuation = await this.valuationService.estimate(
      this.toValuationRequest(item, condition),
      referenceYear,
    );

    const suggestion = this.computePrice(valuation.estimatedValue, valuation.confidence, valuation.comparables.length);
    await this.cache.set(cacheKey, suggestion);
    return suggestion;
  }

  /**
   * Pure price computation from a USD estimate — exposed for unit testing the
   * premium/range logic without touching the repository or cache.
   */
  computePrice(
    estimatedValueUsd: number,
    confidence: ValuationConfidence,
    comparableCount: number,
  ): ListingPriceSuggestion {
    const estimatedMarketValue = usdToVnd(estimatedValueUsd, this.usdToVndRate);
    const premium = SELLER_PREMIUM_BY_CONFIDENCE[confidence];
    const spread = PRICE_RANGE_SPREAD_BY_CONFIDENCE[confidence];

    const suggestedPrice = roundVnd(estimatedMarketValue * (1 + premium));
    const low = roundVnd(estimatedMarketValue * (1 - spread));
    const high = roundVnd(suggestedPrice * (1 + spread));

    return {
      suggestedPrice,
      estimatedMarketValue,
      priceRange: { low, high },
      confidence,
      currency: LISTING_CURRENCY,
      rationale: this.buildRationale(confidence, comparableCount),
      cached: false,
    };
  }

  private buildRationale(confidence: ValuationConfidence, comparableCount: number): string {
    if (comparableCount > 0) {
      const noun = comparableCount === 1 ? 'comparable listing' : 'comparable listings';
      return `Based on ${comparableCount} ${noun} and a ${confidence}-confidence valuation.`;
    }
    if (confidence === 'low') {
      return 'Estimated from category averages — limited comparable data, treat as a rough guide.';
    }
    return `Estimated from the asset's purchase price and age (${confidence} confidence).`;
  }

  // ---------------------------------------------------------------------------
  // Deliverable 2: listing auto-fill
  // ---------------------------------------------------------------------------

  /**
   * Build a pre-populated listing draft from stored asset data. The draft is
   * NOT persisted — the frontend uses it to pre-fill the create-listing form.
   */
  async autofill(itemId: string): Promise<ListingAutofillDraft> {
    const item = await this.requireItem(itemId);
    const condition = this.toValuationCondition(item.condition);

    return {
      title: this.buildTitle(item),
      category: item.category,
      condition,
      description: await this.buildDescription(item, condition),
      photos: Array.isArray(item.photos) ? item.photos : [],
      location: { city: item.location?.trim() ? item.location.trim() : null },
    };
  }

  /**
   * Title = the item name (already the descriptive label sellers expect, per
   * the DXS-145 example). Falls back to brand/model only when the name is blank.
   */
  private buildTitle(item: Item): string {
    const name = (item.name ?? '').trim();
    if (name) {
      return name;
    }
    const fallback = [item.brand, item.model]
      .map((v) => (v ?? '').trim())
      .filter((v) => v.length > 0)
      .join(' ')
      .trim();
    return fallback || 'Untitled item';
  }

  private async buildDescription(item: Item, condition: ValuationCondition): Promise<string> {
    if (this.useLocalMock || !this.openai) {
      return this.templateDescription(item, condition);
    }
    try {
      return await this.generateDescription(item, condition);
    } catch (err) {
      this.logger.warn(`Description generation failed, using template: ${(err as Error).message}`);
      return this.templateDescription(item, condition);
    }
  }

  /** Deterministic, hallucination-free fallback description. */
  private templateDescription(item: Item, condition: ValuationCondition): string {
    const name = (item.name ?? 'Item').trim();
    const readableCondition = condition.replace(/_/g, ' ');
    const parts = [`${name} in ${readableCondition} condition.`];

    const year = this.purchaseYear(item.purchaseDate);
    if (year) {
      parts.push(`Purchased in ${year}.`);
    }
    const notes = (item.notes ?? '').trim();
    if (notes) {
      parts.push(notes);
    }
    return parts.join(' ');
  }

  private async generateDescription(item: Item, condition: ValuationCondition): Promise<string> {
    const model = this.configService.get<string>('OPENAI_TEXT_MODEL') ?? 'gpt-4o-mini';
    const facts = this.factSheet(item, condition);

    const response = await this.openai!.responses.create({
      model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: DESCRIPTION_SYSTEM_PROMPT }] },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Write a listing description from these asset facts:\n${facts}`,
            },
          ],
        },
      ],
      max_output_tokens: 200,
    });

    const text = (response.output_text ?? '').trim();
    return text.length > 0 ? text : this.templateDescription(item, condition);
  }

  /** Compact, model-safe fact list — only what we actually know. */
  private factSheet(item: Item, condition: ValuationCondition): string {
    const year = this.purchaseYear(item.purchaseDate);
    const lines = [
      `name: ${item.name ?? ''}`,
      item.brand ? `brand: ${item.brand}` : null,
      item.model ? `model: ${item.model}` : null,
      `category: ${item.category}`,
      `condition: ${condition.replace(/_/g, ' ')}`,
      year ? `purchaseYear: ${year}` : null,
      item.notes ? `ownerNotes: ${item.notes}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private async requireItem(itemId: string): Promise<Item> {
    const item = await this.itemsRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
    return item;
  }

  /** Build a valuation request from item data, converting VND price → USD. */
  private toValuationRequest(item: Item, condition: ValuationCondition): ValuationRequest {
    // item.purchasePrice is a decimal column → typeorm hands back a string.
    const rawPrice = item.purchasePrice != null ? Number(item.purchasePrice) : undefined;
    const purchasePrice =
      rawPrice && Number.isFinite(rawPrice) && rawPrice > 0
        ? vndToUsd(rawPrice, this.usdToVndRate)
        : undefined;

    return {
      name: item.name ?? '',
      category: item.category,
      condition,
      purchaseYear: this.purchaseYear(item.purchaseDate),
      purchasePrice,
      currency: 'USD',
    };
  }

  private purchaseYear(purchaseDate: Date | string | null | undefined): number | undefined {
    if (!purchaseDate) {
      return undefined;
    }
    const date = purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate);
    const year = date.getUTCFullYear();
    return Number.isFinite(year) ? year : undefined;
  }

  /** ItemCondition enum values mirror ValuationCondition strings 1:1. */
  private toValuationCondition(condition: string | null | undefined): ValuationCondition {
    const valid: ValuationCondition[] = ['new', 'like_new', 'good', 'fair', 'poor'];
    return valid.includes(condition as ValuationCondition)
      ? (condition as ValuationCondition)
      : 'good';
  }

  private getBooleanConfig(key: string, fallback: boolean): boolean {
    const raw = this.configService.get<string>(key);
    if (raw == null || raw.trim() === '') {
      return fallback;
    }
    return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
  }

  private getNumberConfig(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (raw == null || raw.trim() === '') {
      return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
