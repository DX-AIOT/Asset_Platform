import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ListingsService } from '../src/marketplace/listings.service';
import {
  Listing,
  ListingCondition,
  ListingStatus,
  ListingType,
} from '../src/marketplace/entities/listing.entity';
import { Item, ItemCategory } from '../src/items/entities/item.entity';
import { CreateListingDto } from '../src/marketplace/dto/create-listing.dto';
import { UpdateListingDto } from '../src/marketplace/dto/update-listing.dto';
import { BrowseListingsQueryDto, MyListingsQueryDto } from '../src/marketplace/dto/browse-listings-query.dto';

/**
 * API-level integration tests for the marketplace listing CRUD and
 * browse/search/filter endpoints ([DXS-144], resolved via [DXS-149]).
 *
 * Wires ListingsService through Nest DI with stub repositories — no database
 * or HTTP server needed. The QueryBuilder chain is fully mocked so the service
 * logic (filter application, status guards, ownership checks) is the system
 * under test.
 */

// ── Shared fixtures ──────────────────────────────────────────────────────────

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ITEM_A = '11111111-1111-4111-8111-111111111001'; // owned by USER_A
const ITEM_B = '22222222-2222-4222-8222-222222222002'; // owned by USER_B
const LIST_1 = '33333333-3333-4333-8333-333333333001';

const BASE_DATE = new Date('2026-05-30T00:00:00.000Z');

const itemA: Partial<Item> = {
  id: ITEM_A,
  userId: USER_A,
  name: 'iPhone 14 Pro',
  category: ItemCategory.MOBILE_PHONES,
};

const makeListing = (override: Partial<Listing> = {}): Listing =>
  ({
    id: LIST_1,
    itemId: ITEM_A,
    sellerId: USER_A,
    price: 29900000,
    currency: 'VND',
    condition: ListingCondition.GOOD,
    listingType: ListingType.SELL,
    status: ListingStatus.DRAFT,
    photos: [],
    description: null,
    location: null,
    lat: null,
    lng: null,
    city: null,
    publishedAt: null,
    expiresAt: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    item: null as unknown as Item,
    seller: null as any,
    ...override,
  } as Listing);

// ── Helper: build a fresh Nest module with stub repos ─────────────────────────

function buildMockQb(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const qb: Record<string, jest.Mock> = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return qb;
}

async function buildModule(
  mockQb: Record<string, jest.Mock>,
  listingRepoOverrides: Partial<Record<string, jest.Mock>> = {},
  itemRepoOverrides: Partial<Record<string, jest.Mock>> = {},
): Promise<{ service: ListingsService; listingRepo: any; itemRepo: any }> {
  const listingRepo = {
    findOne: jest.fn(),
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn((entity: any) =>
      Promise.resolve({ ...entity, id: entity.id ?? LIST_1, createdAt: BASE_DATE, updatedAt: BASE_DATE }),
    ),
    createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    ...listingRepoOverrides,
  };

  const itemRepo = {
    findOne: jest.fn(),
    ...itemRepoOverrides,
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ListingsService,
      { provide: getRepositoryToken(Listing), useValue: listingRepo },
      { provide: getRepositoryToken(Item), useValue: itemRepo },
    ],
  }).compile();

  return { service: module.get(ListingsService), listingRepo, itemRepo };
}

// ── Suite 1: Listing CRUD ────────────────────────────────────────────────────

describe('Listing CRUD', () => {
  // ── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    let service: ListingsService;
    let listingRepo: any;
    let itemRepo: any;

    const dto: CreateListingDto = {
      itemId: ITEM_A,
      price: 29900000,
      currency: 'VND',
      condition: ListingCondition.GOOD,
    };

    beforeEach(async () => {
      ({ service, listingRepo, itemRepo } = await buildModule(buildMockQb()));
    });

    it('creates listing in draft status when item is owned by caller', async () => {
      itemRepo.findOne.mockResolvedValue(itemA);
      listingRepo.create.mockReturnValue(makeListing());
      listingRepo.save.mockResolvedValue(makeListing());

      const result = await service.create(dto, USER_A);

      expect(result.status).toBe(ListingStatus.DRAFT);
      expect(result.sellerId).toBe(USER_A);
      expect(result.itemId).toBe(ITEM_A);
      expect(result.price).toBe(29900000);
      expect(result.currency).toBe('VND');
    });

    it('throws ForbiddenException when itemId belongs to another user', async () => {
      // itemRepo returns null because userId mismatch filters the row out
      itemRepo.findOne.mockResolvedValue(null);

      await expect(service.create({ ...dto, itemId: ITEM_B }, USER_A)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when item does not exist', async () => {
      itemRepo.findOne.mockResolvedValue(null);

      await expect(service.create({ ...dto, itemId: 'nonexistent-uuid' }, USER_A)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── publish() ───────────────────────────────────────────────────────────────

  describe('publish()', () => {
    let service: ListingsService;
    let listingRepo: any;

    beforeEach(async () => {
      ({ service, listingRepo } = await buildModule(buildMockQb()));
    });

    it('sets status=active and stamps publishedAt for the owner', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing());
      listingRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      const result = await service.publish(LIST_1, USER_A);

      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('sets expiresAt 30 days after publishedAt', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing());
      listingRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      const result = await service.publish(LIST_1, USER_A);

      const diffMs = result.expiresAt!.getTime() - result.publishedAt!.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(30);
    });

    it('throws ForbiddenException when called by a different user — 403', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing()); // sellerId = USER_A

      await expect(service.publish(LIST_1, USER_B)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException for a non-existent listing — 404', async () => {
      listingRepo.findOne.mockResolvedValue(null);

      await expect(service.publish(LIST_1, USER_A)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── findDetail() ─────────────────────────────────────────────────────────────

  describe('findDetail()', () => {
    let service: ListingsService;
    let mockQb: ReturnType<typeof buildMockQb>;

    beforeEach(async () => {
      mockQb = buildMockQb();
      ({ service } = await buildModule(mockQb));
    });

    it('returns listing detail for a known active listing — 200', async () => {
      const activeListing = makeListing({ status: ListingStatus.ACTIVE });
      mockQb.getOne.mockResolvedValue(activeListing);

      const result = await service.findDetail(LIST_1);

      expect(result.id).toBe(LIST_1);
      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(result.sellerId).toBe(USER_A);
    });

    it('throws NotFoundException for a non-existent listing — 404', async () => {
      mockQb.getOne.mockResolvedValue(null);

      await expect(service.findDetail('missing-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException for a deleted listing (QB filters it out) — 404', async () => {
      // The service adds `status != deleted` to the QB; simulate the DB returning null
      mockQb.getOne.mockResolvedValue(null);

      await expect(service.findDetail(LIST_1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('applies a status != deleted filter to the QueryBuilder', async () => {
      mockQb.getOne.mockResolvedValue(makeListing({ status: ListingStatus.ACTIVE }));
      await service.findDetail(LIST_1);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasDeletedFilter = andWhereCalls.some(([sql]) =>
        sql.includes('status') && sql.includes('deleted'),
      );
      expect(hasDeletedFilter).toBe(true);
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    let service: ListingsService;
    let listingRepo: any;

    const dto: UpdateListingDto = { description: 'Updated — barely used' };

    beforeEach(async () => {
      ({ service, listingRepo } = await buildModule(buildMockQb()));
    });

    it('updates fields on a draft listing for the owner — 200', async () => {
      const draft = makeListing();
      listingRepo.findOne.mockResolvedValue(draft);
      listingRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      const result = await service.update(LIST_1, USER_A, dto);

      expect(result.description).toBe('Updated — barely used');
    });

    it('updates fields on an inactive listing for the owner — 200', async () => {
      const inactive = makeListing({ status: ListingStatus.INACTIVE });
      listingRepo.findOne.mockResolvedValue(inactive);
      listingRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      const result = await service.update(LIST_1, USER_A, dto);

      expect(result.description).toBe('Updated — barely used');
    });

    it('throws ForbiddenException when called by a non-owner — 403', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing());

      await expect(service.update(LIST_1, USER_B, dto)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when updating an active listing — 400', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing({ status: ListingStatus.ACTIVE }));

      await expect(service.update(LIST_1, USER_A, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException for a non-existent listing — 404', async () => {
      listingRepo.findOne.mockResolvedValue(null);

      await expect(service.update('missing-id', USER_A, dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── unpublish() ──────────────────────────────────────────────────────────────

  describe('unpublish()', () => {
    let service: ListingsService;
    let listingRepo: any;

    beforeEach(async () => {
      ({ service, listingRepo } = await buildModule(buildMockQb()));
    });

    it('sets status=inactive for the owner — 200', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing({ status: ListingStatus.ACTIVE }));
      listingRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      const result = await service.unpublish(LIST_1, USER_A);

      expect(result.status).toBe(ListingStatus.INACTIVE);
    });

    it('throws ForbiddenException when called by a non-owner — 403', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing({ status: ListingStatus.ACTIVE }));

      await expect(service.unpublish(LIST_1, USER_B)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException for a non-existent listing — 404', async () => {
      listingRepo.findOne.mockResolvedValue(null);

      await expect(service.unpublish('missing-id', USER_A)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── remove() (soft-delete) ───────────────────────────────────────────────────

  describe('remove()', () => {
    let service: ListingsService;
    let listingRepo: any;

    beforeEach(async () => {
      ({ service, listingRepo } = await buildModule(buildMockQb()));
    });

    it('soft-deletes by setting status=deleted for the owner — 204', async () => {
      const draft = makeListing();
      listingRepo.findOne.mockResolvedValue(draft);

      let savedEntity: any;
      listingRepo.save.mockImplementation((entity: any) => {
        savedEntity = entity;
        return Promise.resolve(entity);
      });

      await service.remove(LIST_1, USER_A);

      expect(savedEntity.status).toBe(ListingStatus.DELETED);
    });

    it('throws ForbiddenException when called by a non-owner — 403', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing());

      await expect(service.remove(LIST_1, USER_B)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException for a non-existent listing — 404', async () => {
      listingRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing-id', USER_A)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('treats a previously deleted listing as not-found — 404', async () => {
      // findOwned checks status === DELETED and treats it as 404
      listingRepo.findOne.mockResolvedValue(makeListing({ status: ListingStatus.DELETED }));

      await expect(service.remove(LIST_1, USER_A)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

// ── Suite 2: Browse / Search / Filter ────────────────────────────────────────

describe('Listing Browse / Search / Filter', () => {
  let service: ListingsService;
  let mockQb: ReturnType<typeof buildMockQb>;

  const makeActiveListings = (count: number, overrides: Partial<Listing> = {}): Listing[] =>
    Array.from({ length: count }, (_, i) =>
      makeListing({ id: `active-listing-${i}`, status: ListingStatus.ACTIVE, ...overrides }),
    );

  beforeEach(async () => {
    mockQb = buildMockQb();
    ({ service } = await buildModule(mockQb));
  });

  // ── Base browse ──────────────────────────────────────────────────────────────

  describe('browse() — base', () => {
    it('returns only active listings with pagination metadata', async () => {
      const actives = makeActiveListings(3);
      mockQb.getManyAndCount.mockResolvedValue([actives, 3]);

      const result = await service.browse({} as BrowseListingsQueryDto);

      expect(result.total).toBe(3);
      expect(result.listings).toHaveLength(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('filters by status=active at the QueryBuilder level', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({} as BrowseListingsQueryDto);

      const whereCalls: [string, any][] = mockQb.where.mock.calls;
      const hasStatusFilter = whereCalls.some(([sql]) =>
        sql.includes('status') && sql.includes(':status'),
      );
      expect(hasStatusFilter).toBe(true);

      // Confirm the bound value is ACTIVE
      const statusCall = whereCalls.find(([sql]) => sql.includes('status'));
      expect(statusCall?.[1]).toMatchObject({ status: ListingStatus.ACTIVE });
    });

    it('always applies an expiresAt > NOW() guard (expired listings excluded)', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({} as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasExpiryGuard = andWhereCalls.some(([sql]) =>
        sql.includes('expiresAt') && (sql.includes('NOW()') || sql.includes('IS NULL')),
      );
      expect(hasExpiryGuard).toBe(true);
    });

    it('respects page and limit parameters', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ page: 3, limit: 10 } as BrowseListingsQueryDto);

      expect(mockQb.skip).toHaveBeenCalledWith(20); // (3-1)*10
      expect(mockQb.take).toHaveBeenCalledWith(10);
    });

    it('caps limit at 100', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ limit: 999 } as BrowseListingsQueryDto);

      expect(mockQb.take).toHaveBeenCalledWith(100);
    });
  });

  // ── Text search ──────────────────────────────────────────────────────────────

  describe('browse() — ?q= text search', () => {
    it('applies ILIKE filter on description and item.name when q is provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ q: 'iPhone' } as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasTextSearch = andWhereCalls.some(([sql]) =>
        sql.toLowerCase().includes('ilike'),
      );
      expect(hasTextSearch).toBe(true);

      // Check that the bound value wraps the keyword in %
      const textCall = andWhereCalls.find(([sql]) => sql.toLowerCase().includes('ilike'));
      expect(textCall?.[1]).toMatchObject({ q: '%iPhone%' });
    });

    it('does NOT apply ILIKE filter when q is omitted', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({} as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasTextSearch = andWhereCalls.some(([sql]) =>
        sql.toLowerCase().includes('ilike'),
      );
      expect(hasTextSearch).toBe(false);
    });
  });

  // ── Category filter ──────────────────────────────────────────────────────────

  describe('browse() — ?category= filter', () => {
    it('applies category filter when category is provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ category: ItemCategory.ELECTRONICS } as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasCategoryFilter = andWhereCalls.some(([sql]) =>
        sql.includes('category') && sql.includes(':category'),
      );
      expect(hasCategoryFilter).toBe(true);

      const catCall = andWhereCalls.find(([sql]) => sql.includes('category') && sql.includes(':category'));
      expect(catCall?.[1]).toMatchObject({ category: ItemCategory.ELECTRONICS });
    });

    it('does NOT apply category filter when category is omitted', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({} as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasCategoryFilter = andWhereCalls.some(([sql]) =>
        sql.includes('category') && sql.includes(':category'),
      );
      expect(hasCategoryFilter).toBe(false);
    });
  });

  // ── Condition filter ─────────────────────────────────────────────────────────

  describe('browse() — ?condition= filter', () => {
    it('applies condition filter when condition is provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ condition: ListingCondition.GOOD } as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasConditionFilter = andWhereCalls.some(([sql]) =>
        sql.includes('condition') && sql.includes(':condition'),
      );
      expect(hasConditionFilter).toBe(true);

      const condCall = andWhereCalls.find(([sql]) => sql.includes('condition') && sql.includes(':condition'));
      expect(condCall?.[1]).toMatchObject({ condition: ListingCondition.GOOD });
    });

    it('does NOT apply condition filter when condition is omitted', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({} as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasConditionFilter = andWhereCalls.some(([sql]) =>
        sql.includes('condition') && sql.includes(':condition'),
      );
      expect(hasConditionFilter).toBe(false);
    });
  });

  // ── Price range filter ───────────────────────────────────────────────────────

  describe('browse() — ?priceMin / ?priceMax filter', () => {
    it('applies priceMin filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ priceMin: 500000 } as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasPriceMin = andWhereCalls.some(([sql]) =>
        sql.includes('price') && sql.includes(':priceMin'),
      );
      expect(hasPriceMin).toBe(true);

      const priceMinCall = andWhereCalls.find(([sql]) => sql.includes(':priceMin'));
      expect(priceMinCall?.[1]).toMatchObject({ priceMin: 500000 });
    });

    it('applies priceMax filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ priceMax: 2000000 } as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasPriceMax = andWhereCalls.some(([sql]) =>
        sql.includes('price') && sql.includes(':priceMax'),
      );
      expect(hasPriceMax).toBe(true);

      const priceMaxCall = andWhereCalls.find(([sql]) => sql.includes(':priceMax'));
      expect(priceMaxCall?.[1]).toMatchObject({ priceMax: 2000000 });
    });

    it('applies both priceMin and priceMax when both are provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ priceMin: 500000, priceMax: 2000000 } as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasPriceMin = andWhereCalls.some(([sql]) => sql.includes(':priceMin'));
      const hasPriceMax = andWhereCalls.some(([sql]) => sql.includes(':priceMax'));

      expect(hasPriceMin).toBe(true);
      expect(hasPriceMax).toBe(true);
    });

    it('does NOT apply price filters when neither priceMin nor priceMax are provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({} as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasPriceFilter = andWhereCalls.some(([sql]) =>
        sql.includes(':priceMin') || sql.includes(':priceMax'),
      );
      expect(hasPriceFilter).toBe(false);
    });
  });

  // ── Geo / radius filter ──────────────────────────────────────────────────────

  describe('browse() — ?lat / ?lng / ?radiusKm geo filter', () => {
    it('applies Haversine radius filter when lat, lng are provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ lat: 10.8, lng: 106.7, radiusKm: 10 } as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasGeoFilter = andWhereCalls.some(([sql]) =>
        sql.includes(':lat') && sql.includes(':lng'),
      );
      expect(hasGeoFilter).toBe(true);

      const geoCall = andWhereCalls.find(([sql]) => sql.includes(':lat') && sql.includes(':lng'));
      expect(geoCall?.[1]).toMatchObject({ lat: 10.8, lng: 106.7, radiusKm: 10 });
    });

    it('defaults radiusKm to 50 when lat/lng are given but radiusKm is omitted', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({ lat: 10.8, lng: 106.7 } as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const geoCall = andWhereCalls.find(([sql]) => sql.includes(':lat') && sql.includes(':lng'));
      expect(geoCall?.[1]).toMatchObject({ radiusKm: 50 });
    });

    it('does NOT apply geo filter when lat/lng are omitted', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.browse({} as BrowseListingsQueryDto);

      const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
      const hasGeoFilter = andWhereCalls.some(([sql]) =>
        sql.includes(':lat') && sql.includes(':lng'),
      );
      expect(hasGeoFilter).toBe(false);
    });
  });
});

// ── Suite 3: My Listings ──────────────────────────────────────────────────────

describe('My Listings', () => {
  let service: ListingsService;
  let mockQb: ReturnType<typeof buildMockQb>;

  beforeEach(async () => {
    mockQb = buildMockQb();
    ({ service } = await buildModule(mockQb));
  });

  it('returns all non-deleted statuses for the authenticated user', async () => {
    const myListings = [
      makeListing({ id: 'l1', status: ListingStatus.DRAFT }),
      makeListing({ id: 'l2', status: ListingStatus.ACTIVE }),
      makeListing({ id: 'l3', status: ListingStatus.INACTIVE }),
    ];
    mockQb.getManyAndCount.mockResolvedValue([myListings, 3]);

    const result = await service.findMyListings(USER_A, {} as MyListingsQueryDto);

    expect(result.total).toBe(3);
    expect(result.listings).toHaveLength(3);
    const statuses = result.listings.map((l) => l.status);
    expect(statuses).toContain(ListingStatus.DRAFT);
    expect(statuses).toContain(ListingStatus.ACTIVE);
    expect(statuses).toContain(ListingStatus.INACTIVE);
  });

  it('scopes the query to the caller sellerId', async () => {
    mockQb.getManyAndCount.mockResolvedValue([[], 0]);
    await service.findMyListings(USER_A, {} as MyListingsQueryDto);

    const whereCalls: [string, any][] = mockQb.where.mock.calls;
    const hasSellerFilter = whereCalls.some(([sql]) =>
      sql.includes('sellerId') && sql.includes(':userId'),
    );
    expect(hasSellerFilter).toBe(true);

    const sellerCall = whereCalls.find(([sql]) => sql.includes('sellerId'));
    expect(sellerCall?.[1]).toMatchObject({ userId: USER_A });
  });

  it('excludes deleted listings from my-listings results', async () => {
    mockQb.getManyAndCount.mockResolvedValue([[], 0]);
    await service.findMyListings(USER_A, {} as MyListingsQueryDto);

    const andWhereCalls: [string, any][] = mockQb.andWhere.mock.calls;
    const hasDeletedFilter = andWhereCalls.some(([sql]) =>
      sql.includes('status') && sql.includes('deleted'),
    );
    expect(hasDeletedFilter).toBe(true);
  });

  it('does not expose another user draft listings', async () => {
    // USER_A calls findMyListings; USER_B's drafts should not appear
    // because the query is scoped to sellerId = USER_A
    const userADraft = makeListing({ id: 'l-user-a', sellerId: USER_A, status: ListingStatus.DRAFT });
    mockQb.getManyAndCount.mockResolvedValue([[userADraft], 1]);

    const result = await service.findMyListings(USER_A, {} as MyListingsQueryDto);

    expect(result.listings.every((l) => l.sellerId === USER_A)).toBe(true);

    // Confirm the QB was scoped to USER_A, not USER_B
    const whereCalls: [string, any][] = mockQb.where.mock.calls;
    const sellerCall = whereCalls.find(([sql]) => sql.includes('sellerId'));
    expect(sellerCall?.[1]).not.toMatchObject({ userId: USER_B });
  });

  it('returns paginated results with correct total', async () => {
    const listings = Array.from({ length: 5 }, (_, i) =>
      makeListing({ id: `my-list-${i}` }),
    );
    mockQb.getManyAndCount.mockResolvedValue([listings, 42]);

    const result = await service.findMyListings(USER_A, { page: 2, limit: 5 } as MyListingsQueryDto);

    expect(result.total).toBe(42);
    expect(result.listings).toHaveLength(5);
    expect(mockQb.skip).toHaveBeenCalledWith(5); // (2-1)*5
    expect(mockQb.take).toHaveBeenCalledWith(5);
  });
});
