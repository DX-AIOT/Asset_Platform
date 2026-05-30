import { ConfigService } from '@nestjs/config';
import { VisionRecognitionService } from '../src/ai/vision-recognition.service';

describe('VisionRecognitionService', () => {
  it('maps OpenAI JSON to structured result and keeps fallback off at high confidence', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'test-key';
        if (key === 'OPENAI_LOCAL_MODE') return 'false';
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new VisionRecognitionService(configService);
    (service as any).openai = {
      responses: {
        create: jest.fn().mockResolvedValue({
          output_text: JSON.stringify({
            name: 'iPhone 14 Pro',
            brand: 'Apple',
            model: 'A2890',
            category: 'smartphone',
            confidence: { name: 0.95, brand: 0.97, model: 0.91, category: 0.96 },
          }),
        }),
      },
    };

    const result = await service.recognizeFromBase64('a'.repeat(64));

    expect(result.name.value).toBe('iPhone 14 Pro');
    expect(result.brand.confidence).toBe(0.97);
    expect(result.fallbackSuggested).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('enables fallback when low confidence model/name is returned', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'test-key';
        if (key === 'OPENAI_LOCAL_MODE') return 'false';
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new VisionRecognitionService(configService);
    (service as any).openai = {
      responses: {
        create: jest.fn().mockResolvedValue({
          output_text: JSON.stringify({
            name: 'Xe may Honda',
            brand: 'Honda',
            model: null,
            category: 'motorbike',
            confidence: { name: 0.61, brand: 0.88, model: 0.2, category: 0.84 },
          }),
        }),
      },
    };

    const result = await service.recognizeFromBase64('b'.repeat(64));

    expect(result.fallbackSuggested).toBe(true);
    expect(result.category.value).toBe('motorbike');
  });

  it('returns local fallback payload when OPENAI_LOCAL_MODE is enabled', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_LOCAL_MODE') return 'true';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new VisionRecognitionService(configService);
    const result = await service.recognizeFromBase64('c'.repeat(64));

    expect(result).toMatchObject({
      name: { value: null, confidence: 0 },
      brand: { value: null, confidence: 0 },
      model: { value: null, confidence: 0 },
      category: { value: 'other', confidence: 0.4 },
      fallbackSuggested: true,
    });
  });
});
