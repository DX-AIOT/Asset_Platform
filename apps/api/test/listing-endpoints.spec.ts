import { NotFoundException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiController } from '../src/ai/ai.controller';
import { MarketValuationService } from '../src/ai/market-valuation.service';
import { ValuationCacheService } from '../src/ai/valuation-cache.service';
import { ListingSuggestionService } from '../src/ai/listing-suggestion.service';
import { ListingSuggestionCacheService } from '../src/ai/listing-suggestion-cache.service';
import { VisionRecognitionService } from '../src/ai/vision-recognition.service';
import { BarcodeLookupService } from '../src/ai/barcode-lookup.service';
import { ConditionAssessmentService } from '../src/ai/condition-assessment.service';
import { ListingPriceSuggestDto } from '../src/ai/dto/listing-price-suggest.dto';
import { Item, ItemCategory, ItemCondition } from '../src/items/entities/item.entity';

/**
 * API-level integration test for the listing assistant endpoints (DXS-145),
 * wiring the real ListingSuggestionService + MarketValuationService through the
 * Nest DI container. Item lookups hit a stub repository; OpenAI is disabled via
 * OPENAI_LOCAL_MODE so description generation uses the deterministic template.
 */
describe('Listing assistant endpoints (integration)', () => {
  let controller: AiController;

  const ITEM_ID = '7a8b9c0d-1e2f-4a5b-8c0d-1e2f3a4b5c6d';
  const item: Partial<Item> = {
    id: ITEM_ID,
    name: 'iPhone 14 Pro Max 256GB',
    brand: 'Apple',
    model: '',
    category: ItemCategory.MOBILE_PHONES,
    condition: ItemCondition.GOOD,
    purchaseDate: new Date('2023-01-15T00:00:00.000Z'),
    purchasePrice: 28500000,
    location: 'Ho Chi Minh City',
    photos: ['https://cdn/p1.jpg'],
    notes: 'Light scratches on the frame.',
  };

  const repo = {
    findOne: jest.fn(({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(id === item.id ? (item as Item) : null),
    ),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ OPENAI_LOCAL_MODE: 'true', USD_TO_VND_RATE: '25000' })],
        }),
      ],
      controllers: [AiController],
      providers: [
        MarketValuationService,
        ValuationCacheService,
        ListingSuggestionService,
        ListingSuggestionCacheService,
        BarcodeLookupService,
        { provide: getRepositoryToken(Item), useValue: repo },
        { provide: VisionRecognitionService, useValue: { recognizeFromBase64: jest.fn() } },
        { provide: ConditionAssessmentService, useValue: { assess: jest.fn() } },
      ],
    }).compile();

    controller = moduleRef.get(AiController);
  });

  describe('POST /ai/listing-price-suggest', () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metadata = { type: 'body' as const, metatype: ListingPriceSuggestDto };

    it('returns a VND price suggestion with range, confidence, and rationale', async () => {
      const dto = await pipe.transform(
        { itemId: ITEM_ID, condition: 'good', listingType: 'sell' },
        metadata,
      );
      const result = await controller.listingPriceSuggest(dto);

      expect(result.currency).toBe('VND');
      expect(result.estimatedMarketValue).toBeGreaterThan(0);
      expect(result.suggestedPrice).toBeGreaterThanOrEqual(result.estimatedMarketValue);
      expect(result.priceRange.low).toBeLessThan(result.priceRange.high);
      expect(['high', 'medium', 'low']).toContain(result.confidence);
      expect(typeof result.rationale).toBe('string');
      expect(result.rationale.length).toBeGreaterThan(0);
    });

    it('rejects a non-uuid itemId via validation', async () => {
      await expect(pipe.transform({ itemId: 'not-a-uuid' }, metadata)).rejects.toBeDefined();
    });

    it('throws NotFoundException for an unknown item', async () => {
      const dto = await pipe.transform(
        { itemId: '11111111-1111-4111-8111-111111111111' },
        metadata,
      );
      await expect(controller.listingPriceSuggest(dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('GET /ai/listing-autofill/:itemId', () => {
    it('returns a coherent pre-filled draft', async () => {
      const draft = await controller.listingAutofill(ITEM_ID);

      expect(draft.title).toBe('iPhone 14 Pro Max 256GB');
      expect(draft.category).toBe('mobile_phones');
      expect(draft.condition).toBe('good');
      expect(draft.photos).toEqual(['https://cdn/p1.jpg']);
      expect(draft.location).toEqual({ city: 'Ho Chi Minh City' });
      expect(draft.description).toContain('good condition');
      expect(draft.description).toContain('Light scratches on the frame.');
    });

    it('throws NotFoundException for an unknown item', async () => {
      await expect(controller.listingAutofill('does-not-exist')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
