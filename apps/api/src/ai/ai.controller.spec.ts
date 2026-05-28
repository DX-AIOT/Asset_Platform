import { BadRequestException } from '@nestjs/common';
import { AiController } from './ai.controller';
import { VisionRecognitionService } from './vision-recognition.service';
import { BarcodeLookupService } from './barcode-lookup.service';

describe('AiController', () => {
  const createController = () => {
    const mockVisionService = {
      recognizeFromBase64: jest.fn().mockResolvedValue({
        name: { value: 'iPhone', confidence: 0.9 },
        brand: { value: 'Apple', confidence: 0.95 },
        model: { value: 'A2890', confidence: 0.88 },
        category: { value: 'smartphone', confidence: 0.92 },
        fallbackSuggested: false,
        latencyMs: 120,
      }),
    } as unknown as VisionRecognitionService;

    const barcodeService = new BarcodeLookupService();
    const controller = new AiController(mockVisionService, barcodeService);

    return { controller, mockVisionService };
  };

  it('forwards image payload to recognition service', async () => {
    const { controller, mockVisionService } = createController();
    const response = await controller.recognize({ imageBase64: 'abc123' });

    expect(mockVisionService.recognizeFromBase64).toHaveBeenCalledWith('abc123');
    expect(response.category.value).toBe('smartphone');
  });

  it('returns product details for known barcode', () => {
    const { controller } = createController();
    const result = controller.lookupBarcode({ barcode: '8806090488799' });

    expect(result.found).toBe(true);
    expect(result.fallbackOnly).toBe(false);
    expect(result.product?.brand).toBe('Samsung');
  });

  it('returns fallback for unknown barcode', () => {
    const { controller } = createController();
    const result = controller.lookupBarcode({ barcode: '1234567890123' });

    expect(result.found).toBe(false);
    expect(result.fallbackOnly).toBe(true);
    expect(result.product).toBeNull();
  });

  it('throws validation error for empty barcode', () => {
    const { controller } = createController();

    expect(() => controller.lookupBarcode({ barcode: ' ' })).toThrow(
      BadRequestException,
    );
  });
});
