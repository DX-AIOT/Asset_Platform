import { NotFoundException } from '@nestjs/common';
import { ItemsService } from '../src/items/items.service';
import { ItemCategory, ItemCondition } from '../src/items/entities/item.entity';
import { CreateItemDto } from '../src/items/dto';

function makeItem(overrides: Partial<any> = {}): any {
  return {
    id: 'item-1',
    name: 'Test Item',
    category: ItemCategory.ELECTRONICS,
    condition: ItemCondition.GOOD,
    purchaseDate: null,
    purchasePrice: null,
    depreciationRatePercent: null,
    depreciatedValue: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(items: any[]): { service: ItemsService; repo: any } {
  const repo = {
    find: jest.fn().mockResolvedValue(items),
    findOne: jest.fn().mockImplementation(({ where }) => {
      const found = items.find(
        (i) => i.id === where.id && i.userId === where.userId,
      );
      return Promise.resolve(found ?? null);
    }),
    create: jest.fn().mockImplementation((data) => ({ id: 'new-item', ...data })),
    save: jest.fn().mockImplementation((item) => Promise.resolve(item)),
    remove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  } as any;
  const conditionAssessmentService = {
    assess: jest.fn().mockResolvedValue(undefined),
  } as any;
  const priceHistoryService = {
    recordSnapshot: jest.fn().mockResolvedValue(null),
  } as any;
  return { service: new ItemsService(repo, conditionAssessmentService, priceHistoryService), repo };
}

const CURRENT_YEAR = new Date().getFullYear();

describe('ItemsService — depreciation', () => {
  describe('getDepreciation — null purchaseDate', () => {
    it('returns null currentValue and empty history when purchaseDate is missing', async () => {
      const { service } = makeService([makeItem({ id: 'item-1', userId: 'user-1' })]);
      const result = await service.getDepreciation('item-1', 'user-1');

      expect(result.currentValue).toBeNull();
      expect(result.percentLost).toBeNull();
      expect(result.valueHistory).toHaveLength(0);
      expect(result.annualRatePercent).toBe(20); // electronics default
    });

    it('returns null currentValue when purchasePrice is missing', async () => {
      const { service } = makeService([
        makeItem({ id: 'item-1', userId: 'user-1', purchaseDate: new Date('2022-01-01') }),
      ]);
      const result = await service.getDepreciation('item-1', 'user-1');
      expect(result.currentValue).toBeNull();
      expect(result.valueHistory).toHaveLength(0);
    });
  });

  describe('getDepreciation — category default rates', () => {
    it('uses 20% for electronics', async () => {
      const item = makeItem({
        id: 'item-1',
        userId: 'user-1',
        category: ItemCategory.ELECTRONICS,
        purchaseDate: new Date(`${CURRENT_YEAR}-01-01`),
        purchasePrice: 1000,
      });
      const { service } = makeService([item]);
      const result = await service.getDepreciation('item-1', 'user-1');
      expect(result.annualRatePercent).toBe(20);
      expect(result.currentValue).toBe(1000); // year 0
      expect(result.percentLost).toBe(0);
    });

    it('uses 15% for vehicles', async () => {
      const item = makeItem({
        id: 'item-1',
        userId: 'user-1',
        category: ItemCategory.VEHICLES,
        purchaseDate: new Date(`${CURRENT_YEAR - 1}-01-01`),
        purchasePrice: 20000,
      });
      const { service } = makeService([item]);
      const result = await service.getDepreciation('item-1', 'user-1');
      expect(result.annualRatePercent).toBe(15);
      // After 1 year at 15%: 20000 * 0.85 = 17000
      expect(result.currentValue).toBe(17000);
      expect(result.percentLost).toBe(15);
    });

    it('uses 10% for furniture', async () => {
      const item = makeItem({
        id: 'item-1',
        userId: 'user-1',
        category: ItemCategory.FURNITURE,
        purchaseDate: new Date(`${CURRENT_YEAR - 2}-01-01`),
        purchasePrice: 1000,
      });
      const { service } = makeService([item]);
      const result = await service.getDepreciation('item-1', 'user-1');
      expect(result.annualRatePercent).toBe(10);
      // After 2 years at 10%: 1000 * 0.9^2 = 810
      expect(result.currentValue).toBe(810);
    });

    it('uses 12% for appliances', async () => {
      const item = makeItem({
        id: 'item-1',
        userId: 'user-1',
        category: ItemCategory.APPLIANCES,
        purchaseDate: new Date(`${CURRENT_YEAR - 1}-01-01`),
        purchasePrice: 500,
      });
      const { service } = makeService([item]);
      const result = await service.getDepreciation('item-1', 'user-1');
      expect(result.annualRatePercent).toBe(12);
      // After 1 year at 12%: 500 * 0.88 = 440
      expect(result.currentValue).toBe(440);
    });
  });

  describe('getDepreciation — custom rate overrides category default', () => {
    it('uses item-level depreciationRatePercent when set', async () => {
      const item = makeItem({
        id: 'item-1',
        userId: 'user-1',
        category: ItemCategory.ELECTRONICS,
        purchaseDate: new Date(`${CURRENT_YEAR - 1}-01-01`),
        purchasePrice: 1000,
        depreciationRatePercent: 5,
      });
      const { service } = makeService([item]);
      const result = await service.getDepreciation('item-1', 'user-1');
      expect(result.annualRatePercent).toBe(5);
      // After 1 year at 5%: 1000 * 0.95 = 950
      expect(result.currentValue).toBe(950);
    });
  });

  describe('getDepreciation — valueHistory', () => {
    it('returns yearly snapshots from purchaseYear to current year', async () => {
      const purchaseYear = CURRENT_YEAR - 3;
      const item = makeItem({
        id: 'item-1',
        userId: 'user-1',
        category: ItemCategory.FURNITURE,
        purchaseDate: new Date(`${purchaseYear}-06-15`),
        purchasePrice: 1000,
      });
      const { service } = makeService([item]);
      const result = await service.getDepreciation('item-1', 'user-1');

      expect(result.valueHistory).toHaveLength(4); // purchaseYear, +1, +2, +3
      expect(result.valueHistory[0]).toEqual({
        year: purchaseYear,
        date: `${purchaseYear}-01-01`,
        value: 1000,
      });
      // Year 1: 1000 * 0.9 = 900
      expect(result.valueHistory[1].value).toBe(900);
      // Year 2: 1000 * 0.9^2 = 810
      expect(result.valueHistory[2].value).toBe(810);
      // Year 3: 1000 * 0.9^3 = 729
      expect(result.valueHistory[3].value).toBe(729);
    });

    it('value never goes below zero', async () => {
      const item = makeItem({
        id: 'item-1',
        userId: 'user-1',
        category: ItemCategory.ELECTRONICS,
        purchaseDate: new Date(`${CURRENT_YEAR - 100}-01-01`),
        purchasePrice: 100,
        depreciationRatePercent: 100,
      });
      const { service } = makeService([item]);
      const result = await service.getDepreciation('item-1', 'user-1');
      for (const point of result.valueHistory) {
        expect(point.value).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getDepreciation — not found', () => {
    it('throws NotFoundException for unknown item', async () => {
      const { service } = makeService([]);
      await expect(
        service.getDepreciation('unknown', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculatePortfolioValue — live depreciation', () => {
    it('computes live depreciation for items with purchaseDate', async () => {
      const items = [
        makeItem({
          category: ItemCategory.VEHICLES,
          purchaseDate: new Date(`${CURRENT_YEAR - 1}-01-01`),
          purchasePrice: 20000,
        }),
        makeItem({
          category: ItemCategory.FURNITURE,
          purchaseDate: new Date(`${CURRENT_YEAR - 2}-01-01`),
          purchasePrice: 1000,
        }),
      ];
      const { service } = makeService(items);
      const result = await service.calculatePortfolioValue('user-1');

      // Vehicles 1yr at 15%: 17000; Furniture 2yr at 10%: 810
      expect(result.total).toBe(21000);
      expect(result.depreciated).toBe(17810);
    });

    it('falls back to purchasePrice when purchaseDate is missing', async () => {
      const items = [
        makeItem({ purchasePrice: 500, purchaseDate: null }),
      ];
      const { service } = makeService(items);
      const result = await service.calculatePortfolioValue('user-1');
      expect(result.total).toBe(500);
      expect(result.depreciated).toBe(500);
    });

    it('returns zeros when no items exist', async () => {
      const { service } = makeService([]);
      const result = await service.calculatePortfolioValue('user-1');
      expect(result.total).toBe(0);
      expect(result.depreciated).toBe(0);
    });
  });
});

describe('ItemsService — remove', () => {
  it('removes an item owned by the caller', async () => {
    const item = makeItem({ id: 'item-1', userId: 'user-1' });
    const { service, repo } = makeService([item]);
    await service.remove('item-1', 'user-1');
    expect(repo.remove).toHaveBeenCalledWith(item);
  });

  it('throws NotFoundException when item not found', async () => {
    const { service } = makeService([]);
    await expect(service.remove('missing', 'user-1')).rejects.toThrow(NotFoundException);
  });
});

describe('ItemsService — exportCsv', () => {
  it('returns header row as first line', async () => {
    const { service } = makeService([]);
    const csv = await service.exportCsv('user-1');
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe(
      'id,name,brand,model,category,condition,serial,purchaseDate,purchasePrice,location,warrantyExpiry,notes,depreciationRatePercent,depreciatedValue,createdAt',
    );
  });

  it('returns one data row per item', async () => {
    const items = [
      makeItem({ id: 'i-1', userId: 'user-1', name: 'Laptop' }),
      makeItem({ id: 'i-2', userId: 'user-1', name: 'Phone' }),
    ];
    const { service } = makeService(items);
    const csv = await service.exportCsv('user-1');
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it('escapes commas and quotes in field values', async () => {
    const items = [
      makeItem({ id: 'i-1', userId: 'user-1', name: 'Desk, oak', notes: 'Has "scratches"' }),
    ];
    const { service } = makeService(items);
    const csv = await service.exportCsv('user-1');
    expect(csv).toContain('"Desk, oak"');
    expect(csv).toContain('"Has ""scratches"""');
  });

  it('returns only header when user has no items', async () => {
    const { service } = makeService([]);
    const csv = await service.exportCsv('user-1');
    expect(csv.split('\n')).toHaveLength(1);
  });
});

describe('ItemsService — create', () => {
  it('persists photos in submitted order without mutation', async () => {
    const { service, repo } = makeService([]);
    const photos = ['photo-c.jpg', 'photo-a.jpg', 'photo-b.jpg'];
    const dto: CreateItemDto = { name: 'Camera', photos };

    await service.create(dto, 'user-1');

    const createdArg = repo.create.mock.calls[0][0];
    expect(createdArg.photos).toEqual(photos);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('defaults photos to empty array when not provided', async () => {
    const { service, repo } = makeService([]);
    const dto: CreateItemDto = { name: 'Laptop' };

    await service.create(dto, 'user-1');

    const createdArg = repo.create.mock.calls[0][0];
    expect(createdArg.photos).toEqual([]);
  });

  it('sets userId on created item', async () => {
    const { service, repo } = makeService([]);
    const dto: CreateItemDto = { name: 'Watch' };

    await service.create(dto, 'user-42');

    const createdArg = repo.create.mock.calls[0][0];
    expect(createdArg.userId).toBe('user-42');
  });

  it('returns saved item including photos', async () => {
    const photos = ['img1.jpg', 'img2.jpg'];
    const { service } = makeService([]);
    const dto: CreateItemDto = {
      name: 'Tablet',
      category: ItemCategory.ELECTRONICS,
      photos,
    };

    const result = await service.create(dto, 'user-1');

    expect(result.photos).toEqual(photos);
    expect(result.name).toBe('Tablet');
  });
});
