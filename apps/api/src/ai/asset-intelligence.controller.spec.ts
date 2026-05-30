import { AssetIntelligenceController } from './asset-intelligence.controller';
import { AutoCategoryDuplicateService } from './auto-category-duplicate.service';

describe('AssetIntelligenceController', () => {
  it('returns service output for auto-category and duplicate detection', () => {
    const mockService = {
      evaluate: jest.fn().mockReturnValue({
        autoCategory: { category: 'laptop', confidence: 0.9 },
        duplicateDetection: {
          isDuplicateLikely: true,
          matches: [{ itemId: '1', score: 0.9, reason: 'same_model' }],
        },
      }),
    } as unknown as AutoCategoryDuplicateService;

    const controller = new AssetIntelligenceController(mockService);
    const payload = {
      candidate: { name: 'MacBook Pro', brand: 'Apple', model: 'M3' },
      inventory: [{ id: '1', name: 'MacBook Pro 14', brand: 'Apple', model: 'M3' }],
    };

    const response = controller.classifyAndDetect(payload);

    expect(mockService.evaluate).toHaveBeenCalledWith(payload.candidate, payload.inventory);
    expect(response.autoCategory.category).toBe('laptop');
  });
});
