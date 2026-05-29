import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from '../src/ai/ai.controller';
import { MarketValuationService } from '../src/ai/market-valuation.service';
import { ValuationCacheService } from '../src/ai/valuation-cache.service';
import { VisionRecognitionService } from '../src/ai/vision-recognition.service';
import { BarcodeLookupService } from '../src/ai/barcode-lookup.service';
import { ConditionAssessmentService } from '../src/ai/condition-assessment.service';
import { ValuationRequestDto } from '../src/ai/dto/valuation.dto';

/**
 * API-level integration test for POST /ai/valuation.
 *
 * Builds the AiController through the Nest DI container with the real
 * MarketValuationService + ValuationCacheService (in-memory fallback, no
 * REDIS_URL) and runs request payloads through the same ValidationPipe the
 * HTTP server uses. supertest is not a dependency, so we resolve the controller
 * from the container and validate DTOs explicitly via the pipe.
 */
describe('POST /ai/valuation (integration)', () => {
  let controller: AiController;
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: ValuationRequestDto };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [AiController],
      providers: [
        MarketValuationService,
        ValuationCacheService,
        BarcodeLookupService,
        {
          provide: VisionRecognitionService,
          useValue: { recognizeFromBase64: jest.fn() },
        },
        {
          provide: ConditionAssessmentService,
          useValue: { assess: jest.fn() },
        },
      ],
    }).compile();

    controller = moduleRef.get(AiController);
  });

  it('returns estimatedValue/currency/confidence/comparables for a supported asset', async () => {
    const dto = await pipe.transform(
      { name: 'iPhone 14 Pro', category: 'mobile_phones', condition: 'good', purchaseYear: 2023 },
      metadata,
    );
    const result = await controller.valuation(dto);

    expect(result).toMatchObject({
      currency: 'USD',
      category: 'mobile_phones',
    });
    expect(result.estimatedValue).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(result.confidence);
    expect(Array.isArray(result.comparables)).toBe(true);
    expect(result.comparables.length).toBeGreaterThan(0);
  });

  it('returns confidence=low with a fallback estimate for unsupported categories', async () => {
    const dto = await pipe.transform(
      { name: 'Mystery Item', category: 'collectibles', condition: 'good', purchaseYear: 2021 },
      metadata,
    );
    const result = await controller.valuation(dto);

    expect(result.confidence).toBe('low');
    expect(result.category).toBe('other');
    expect(result.estimatedValue).toBeGreaterThan(0);
  });

  it('rejects payloads with a missing name via validation', async () => {
    await expect(
      pipe.transform({ category: 'laptops' }, metadata),
    ).rejects.toBeDefined();
  });

  it('serves the second identical request from cache', async () => {
    const payload = { name: 'Dell XPS 13', category: 'laptops', condition: 'good', purchaseYear: 2022 };
    const first = await controller.valuation(await pipe.transform(payload, metadata));
    const second = await controller.valuation(await pipe.transform(payload, metadata));

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
  });
});
