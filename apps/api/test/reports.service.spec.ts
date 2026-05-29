import { ReportsService } from '../src/reports/reports.service';
import { ItemCategory, ItemCondition } from '../src/items/entities/item.entity';

function makeItem(overrides: Partial<any> = {}): any {
  return {
    id: 'item-1',
    name: 'Test Laptop',
    brand: 'Dell',
    model: 'XPS 15',
    category: ItemCategory.LAPTOPS,
    condition: ItemCondition.GOOD,
    serial: 'SN123',
    purchaseDate: new Date('2023-06-01'),
    purchasePrice: 2000,
    depreciatedValue: 1600,
    location: 'Office',
    photos: [],
    notes: null,
    warrantyExpiry: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeUser(overrides: Partial<any> = {}): any {
  return {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    ...overrides,
  };
}

function makeService(items: any[], user: any = makeUser()): ReportsService {
  const itemRepo = {
    createQueryBuilder: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(items),
    })),
  } as any;

  const userRepo = {
    findOne: jest.fn().mockResolvedValue(user),
  } as any;

  return new ReportsService(itemRepo, userRepo);
}

describe('ReportsService — generateInsurancePdf', () => {
  it('returns a non-empty Buffer', async () => {
    const service = makeService([makeItem()]);
    const buf = await service.generateInsurancePdf('user-1');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('PDF starts with the PDF magic bytes %PDF', async () => {
    const service = makeService([makeItem()]);
    const buf = await service.generateInsurancePdf('user-1');
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('works with zero items (empty portfolio)', async () => {
    const service = makeService([]);
    const buf = await service.generateInsurancePdf('user-1');
    expect(buf.length).toBeGreaterThan(0);
  });

  it('works when user is null', async () => {
    const service = makeService([makeItem()], null);
    const buf = await service.generateInsurancePdf('user-1');
    expect(buf.length).toBeGreaterThan(0);
  });

  it('filters by categoryIds when provided', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const itemRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as any;

    const userRepo = { findOne: jest.fn().mockResolvedValue(makeUser()) } as any;
    const service = new ReportsService(itemRepo, userRepo);

    await service.generateInsurancePdf('user-1', ['electronics', 'laptops']);

    expect(qb.andWhere).toHaveBeenCalledWith('item.category IN (:...cats)', {
      cats: ['electronics', 'laptops'],
    });
  });

  it('handles item without purchasePrice or depreciatedValue', async () => {
    const item = makeItem({ purchasePrice: null, depreciatedValue: null });
    const service = makeService([item]);
    const buf = await service.generateInsurancePdf('user-1');
    expect(buf.length).toBeGreaterThan(0);
  });

  it('generates in well under 10s for 100 items', async () => {
    const items = Array.from({ length: 100 }, (_, i) =>
      makeItem({ id: `item-${i}`, name: `Asset ${i}`, purchasePrice: 1000 + i }),
    );
    const service = makeService(items);
    const start = Date.now();
    const buf = await service.generateInsurancePdf('user-1');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
    expect(buf.length).toBeGreaterThan(0);
  });
});
