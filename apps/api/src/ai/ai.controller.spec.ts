import { AiController } from './ai.controller';
import { VisionRecognitionService } from './vision-recognition.service';

describe('AiController', () => {
  it('forwards image payload to recognition service', async () => {
    const mockService = {
      recognizeFromBase64: jest.fn().mockResolvedValue({
        name: { value: 'iPhone', confidence: 0.9 },
        brand: { value: 'Apple', confidence: 0.95 },
        model: { value: 'A2890', confidence: 0.88 },
        category: { value: 'smartphone', confidence: 0.92 },
        fallbackSuggested: false,
        latencyMs: 120,
      }),
    } as unknown as VisionRecognitionService;

    const controller = new AiController(mockService);
    const response = await controller.recognize({ imageBase64: 'abc123' });

    expect(mockService.recognizeFromBase64).toHaveBeenCalledWith('abc123');
    expect(response.category.value).toBe('smartphone');
  });
});
