import { AutoCategoryDuplicateService } from './auto-category-duplicate.service';

describe('AutoCategoryDuplicateService', () => {
  const service = new AutoCategoryDuplicateService();

  it('predicts smartphone and flags a likely duplicate when name/brand/model align', () => {
    const result = service.evaluate(
      {
        name: 'Apple iPhone 14 Pro 128GB',
        brand: 'Apple',
        model: 'A2890',
        categoryHint: 'phone',
      },
      [
        {
          id: 'item-1',
          name: 'iPhone 14 Pro 128GB',
          brand: 'Apple',
          model: 'A2890',
          categoryHint: 'smartphone',
        },
        {
          id: 'item-2',
          name: 'Dell XPS 13',
          brand: 'Dell',
          model: 'XPS 13',
          categoryHint: 'laptop',
        },
      ],
    );

    expect(result.autoCategory.category).toBe('smartphone');
    expect(result.autoCategory.confidence).toBeGreaterThan(0.8);
    expect(result.duplicateDetection.isDuplicateLikely).toBe(true);
    expect(result.duplicateDetection.matches[0].itemId).toBe('item-1');
    expect(result.duplicateDetection.matches[0].score).toBeGreaterThanOrEqual(0.82);
  });

  it('returns other with medium confidence and no duplicates for disjoint data', () => {
    const result = service.evaluate(
      {
        name: 'Unknown artisan desk lamp',
      },
      [
        {
          id: 'item-1',
          name: 'Samsung Galaxy S24',
          brand: 'Samsung',
          model: 'S24',
          categoryHint: 'smartphone',
        },
      ],
    );

    expect(result.autoCategory.category).toBe('other');
    expect(result.autoCategory.confidence).toBe(0.5);
    expect(result.duplicateDetection.isDuplicateLikely).toBe(false);
    expect(result.duplicateDetection.matches).toHaveLength(0);
  });
});
