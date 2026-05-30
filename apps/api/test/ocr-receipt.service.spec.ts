import { ConfigService } from '@nestjs/config';
import { OcrReceiptService } from '../src/ai/ocr-receipt.service';

describe('OcrReceiptService normalize', () => {
  const service = new OcrReceiptService(new ConfigService());

  it('normalizes Vietnamese receipt fields', () => {
    const result = service.normalize({
      purchaseDate: '05/01/2026',
      totalAmount: '1.234.567 đ',
      currency: 'vnđ',
      warrantyPeriodMonths: 12,
      confidence: 0.93,
    });

    expect(result).toEqual({
      purchaseDate: '2026-01-05',
      totalAmount: 1234567,
      currency: 'VND',
      warrantyExpiryDate: '2027-01-05',
      confidence: 0.93,
    });
  });

  it('normalizes English invoice fields with explicit warranty date', () => {
    const result = service.normalize({
      purchaseDate: '2026-02-14',
      totalAmount: '$1,299.50',
      currency: 'usd',
      warrantyExpiryDate: 'February 14, 2027',
      confidence: 1.2,
    });

    expect(result).toEqual({
      purchaseDate: '2026-02-14',
      totalAmount: 1299.5,
      currency: 'USD',
      warrantyExpiryDate: '2027-02-14',
      confidence: 1,
    });
  });

  it('handles missing and malformed values safely', () => {
    const result = service.normalize({
      purchaseDate: 'invalid-date',
      totalAmount: 'not-a-number',
      currency: null,
      warrantyPeriodMonths: -6,
      confidence: null,
    });

    expect(result).toEqual({
      purchaseDate: null,
      totalAmount: null,
      currency: null,
      warrantyExpiryDate: null,
      confidence: 0,
    });
  });

  it('uses local fallback extract mode when OPENAI_LOCAL_MODE is true', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_LOCAL_MODE') return 'true';
        return undefined;
      }),
    } as unknown as ConfigService;
    const localService = new OcrReceiptService(configService);

    const result = await localService.extract({
      imageBase64: 'aGVsbG8=',
      mimeType: 'image/jpeg',
    });

    expect(result).toEqual({
      purchaseDate: null,
      totalAmount: null,
      currency: null,
      warrantyExpiryDate: null,
      confidence: 0,
    });
  });
});
