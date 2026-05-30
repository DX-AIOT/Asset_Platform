import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListingsService } from '../src/marketplace/listings.service';
import {
  Listing,
  ListingCondition,
  ListingStatus,
  ListingType,
} from '../src/marketplace/entities/listing.entity';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    itemId: 'item-1',
    sellerId: 'seller-1',
    price: 100,
    currency: 'USD',
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    item: null as any,
    seller: null as any,
    ...overrides,
  };
}

function makeService(
  listings: Listing[],
  items: any[] = [],
): { service: ListingsService; listingRepo: any; itemRepo: any } {
  const listingRepo = {
    findOne: jest.fn().mockImplementation(({ where }) => {
      const found = listings.find((l) => l.id === where.id);
      return Promise.resolve(found ?? null);
    }),
    create: jest.fn().mockImplementation((data) => ({ id: 'new-listing', ...data } as Listing)),
    save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
    createQueryBuilder: jest.fn(),
  } as any;

  const itemRepo = {
    findOne: jest.fn().mockImplementation(({ where }) => {
      const found = items.find((i) => i.id === where.id && i.userId === where.userId);
      return Promise.resolve(found ?? null);
    }),
  } as any;

  const service = new ListingsService(listingRepo, itemRepo);
  return { service, listingRepo, itemRepo };
}

// ── Ownership: create ──────────────────────────────────────────────────────

describe('ListingsService — create', () => {
  it('throws ForbiddenException when item does not belong to caller', async () => {
    const { service } = makeService([], []);
    await expect(
      service.create(
        { itemId: 'item-x', price: 100, condition: ListingCondition.GOOD },
        'user-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates a draft listing when item is owned by caller', async () => {
    const { service, listingRepo } = makeService([], [{ id: 'item-1', userId: 'user-1' }]);
    await service.create(
      { itemId: 'item-1', price: 99.99, condition: ListingCondition.LIKE_NEW },
      'user-1',
    );
    expect(listingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: ListingStatus.DRAFT, sellerId: 'user-1' }),
    );
  });

  it('defaults currency to USD', async () => {
    const { service, listingRepo } = makeService([], [{ id: 'item-1', userId: 'u1' }]);
    await service.create({ itemId: 'item-1', price: 50, condition: ListingCondition.GOOD }, 'u1');
    expect(listingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
  });

  it('defaults photos to empty array', async () => {
    const { service, listingRepo } = makeService([], [{ id: 'item-1', userId: 'u1' }]);
    await service.create({ itemId: 'item-1', price: 50, condition: ListingCondition.GOOD }, 'u1');
    expect(listingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ photos: [] }),
    );
  });
});

// ── Ownership: update ─────────────────────────────────────────────────────

describe('ListingsService — update', () => {
  it('throws ForbiddenException when caller does not own the listing', async () => {
    const listing = makeListing({ sellerId: 'seller-1' });
    const { service } = makeService([listing]);
    await expect(service.update('listing-1', 'other-user', {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws BadRequestException when listing is active', async () => {
    const listing = makeListing({ sellerId: 'seller-1', status: ListingStatus.ACTIVE });
    const { service } = makeService([listing]);
    await expect(service.update('listing-1', 'seller-1', { price: 50 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when listing is sold', async () => {
    const listing = makeListing({ sellerId: 'seller-1', status: ListingStatus.SOLD });
    const { service } = makeService([listing]);
    await expect(service.update('listing-1', 'seller-1', {})).rejects.toThrow(BadRequestException);
  });

  it('allows editing a draft listing', async () => {
    const listing = makeListing({ sellerId: 'seller-1', status: ListingStatus.DRAFT });
    const { service, listingRepo } = makeService([listing]);
    await service.update('listing-1', 'seller-1', { price: 200 });
    expect(listingRepo.save).toHaveBeenCalled();
  });

  it('allows editing an inactive listing', async () => {
    const listing = makeListing({ sellerId: 'seller-1', status: ListingStatus.INACTIVE });
    const { service, listingRepo } = makeService([listing]);
    await service.update('listing-1', 'seller-1', { description: 'updated' });
    expect(listingRepo.save).toHaveBeenCalled();
  });

  it('throws NotFoundException for unknown listing', async () => {
    const { service } = makeService([]);
    await expect(service.update('ghost', 'seller-1', {})).rejects.toThrow(NotFoundException);
  });
});

// ── Publish ───────────────────────────────────────────────────────────────

describe('ListingsService — publish', () => {
  it('throws ForbiddenException when caller does not own the listing', async () => {
    const listing = makeListing({ sellerId: 'seller-1' });
    const { service } = makeService([listing]);
    await expect(service.publish('listing-1', 'other-user')).rejects.toThrow(ForbiddenException);
  });

  it('sets status to active and publishedAt to now', async () => {
    const listing = makeListing({ sellerId: 'seller-1', status: ListingStatus.DRAFT });
    const { service, listingRepo } = makeService([listing]);
    const before = Date.now();
    await service.publish('listing-1', 'seller-1');
    const saved: Listing = listingRepo.save.mock.calls[0][0];
    expect(saved.status).toBe(ListingStatus.ACTIVE);
    expect(saved.publishedAt).toBeInstanceOf(Date);
    expect(saved.publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('sets expiresAt 30 days after publishedAt', async () => {
    const listing = makeListing({ sellerId: 'seller-1' });
    const { service, listingRepo } = makeService([listing]);
    await service.publish('listing-1', 'seller-1');
    const saved: Listing = listingRepo.save.mock.calls[0][0];
    const diff = saved.expiresAt!.getTime() - saved.publishedAt!.getTime();
    expect(diff).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

// ── Unpublish ─────────────────────────────────────────────────────────────

describe('ListingsService — unpublish', () => {
  it('sets status to inactive', async () => {
    const listing = makeListing({ sellerId: 'seller-1', status: ListingStatus.ACTIVE });
    const { service, listingRepo } = makeService([listing]);
    await service.unpublish('listing-1', 'seller-1');
    const saved: Listing = listingRepo.save.mock.calls[0][0];
    expect(saved.status).toBe(ListingStatus.INACTIVE);
  });

  it('throws ForbiddenException when caller does not own the listing', async () => {
    const listing = makeListing({ sellerId: 'seller-1' });
    const { service } = makeService([listing]);
    await expect(service.unpublish('listing-1', 'wrong-user')).rejects.toThrow(ForbiddenException);
  });
});

// ── Remove (soft-delete) ──────────────────────────────────────────────────

describe('ListingsService — remove', () => {
  it('soft-deletes by setting status to deleted', async () => {
    const listing = makeListing({ sellerId: 'seller-1', status: ListingStatus.ACTIVE });
    const { service, listingRepo } = makeService([listing]);
    await service.remove('listing-1', 'seller-1');
    const saved: Listing = listingRepo.save.mock.calls[0][0];
    expect(saved.status).toBe(ListingStatus.DELETED);
  });

  it('throws ForbiddenException when caller does not own the listing', async () => {
    const listing = makeListing({ sellerId: 'seller-1' });
    const { service } = makeService([listing]);
    await expect(service.remove('listing-1', 'intruder')).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException for an already-deleted listing', async () => {
    const listing = makeListing({ sellerId: 'seller-1', status: ListingStatus.DELETED });
    const { service } = makeService([listing]);
    await expect(service.remove('listing-1', 'seller-1')).rejects.toThrow(NotFoundException);
  });
});
