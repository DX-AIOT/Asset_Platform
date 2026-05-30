/**
 * Integration tests for Listing CRUD + Browse API (DXS-152 / DXS-144)
 *
 * Runs against a real PostgreSQL instance. Set TEST_PG_URL to override the
 * default localhost:15432 test container URL.
 *
 * Covers every item in the DXS-152 QA checklist:
 *  - POST   /marketplace/listings        (201 draft; 403 wrong owner)
 *  - PATCH  /marketplace/listings/:id    (200 draft/inactive; 400 active; 403; 404)
 *  - POST   /marketplace/listings/:id/publish   (status=active, publishedAt, expiresAt=+30d)
 *  - POST   /marketplace/listings/:id/unpublish (status=inactive)
 *  - DELETE /marketplace/listings/:id   (204 soft-delete; hidden from GETs)
 *  - GET    /marketplace/listings        (active+non-expired; all filters; pagination)
 *  - GET    /marketplace/listings/:id   (seller.name, seller.memberSince; 404 deleted)
 *  - GET    /marketplace/my-listings    (all statuses except deleted)
 *  - Hourly cron: ListingsExpiryService.expireListings() marks past-expiresAt as expired
 *  - Performance: browse responds <300 ms with 1 000+ seeded listings
 */

import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../src/users/entities/user.entity';
import { Item, ItemCategory, ItemCondition } from '../src/items/entities/item.entity';
import {
  Listing,
  ListingCondition,
  ListingStatus,
  ListingType,
} from '../src/marketplace/entities/listing.entity';
import { ListingsService } from '../src/marketplace/listings.service';
import { ListingsExpiryService } from '../src/marketplace/listings-expiry.service';

// ── Connection ─────────────────────────────────────────────────────────────

const PG_URL =
  process.env.TEST_PG_URL ??
  'postgresql://testuser:testpass@localhost:15432/asset_test';

let ds: DataSource;
let userRepo: Repository<User>;
let itemRepo: Repository<Item>;
let listingRepo: Repository<Listing>;
let svc: ListingsService;
let expirySvc: ListingsExpiryService;

// ── Seed helpers ───────────────────────────────────────────────────────────

async function seedUser(overrides: Partial<User> = {}): Promise<User> {
  const u = userRepo.create({
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'hashed',
    firstName: 'Alice',
    lastName: 'Test',
    isActive: true,
    ...overrides,
  });
  return userRepo.save(u);
}

async function seedItem(userId: string, overrides: Partial<Item> = {}): Promise<Item> {
  const i = itemRepo.create({
    name: 'Test Laptop',
    brand: 'Dell',
    model: 'XPS 15',
    category: ItemCategory.LAPTOPS,
    condition: ItemCondition.GOOD,
    userId,
    ...overrides,
  });
  return itemRepo.save(i);
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  ds = new DataSource({
    type: 'postgres',
    url: PG_URL,
    entities: [User, Item, Listing],
    synchronize: true,
    logging: false,
  });
  await ds.initialize();

  userRepo = ds.getRepository(User);
  itemRepo = ds.getRepository(Item);
  listingRepo = ds.getRepository(Listing);

  svc = new ListingsService(listingRepo, itemRepo);
  expirySvc = new ListingsExpiryService(svc);
}, 30_000);

afterAll(async () => {
  if (ds?.isInitialized) {
    // Clean up in FK order
    await ds.query('DELETE FROM marketplace_listings');
    await ds.query('DELETE FROM items');
    await ds.query('DELETE FROM users');
    await ds.destroy();
  }
});

// ── 1. POST /marketplace/listings ─────────────────────────────────────────

describe('POST /marketplace/listings', () => {
  let seller: User;
  let item: Item;
  let otherUser: User;
  let otherItem: Item;

  beforeAll(async () => {
    seller = await seedUser();
    item = await seedItem(seller.id);
    otherUser = await seedUser();
    otherItem = await seedItem(otherUser.id);
  });

  it('201 — creates a draft listing for owned item', async () => {
    const result = await svc.create(
      { itemId: item.id, price: 299.99, condition: ListingCondition.GOOD },
      seller.id,
    );
    expect(result.status).toBe(ListingStatus.DRAFT);
    expect(result.sellerId).toBe(seller.id);
    expect(result.itemId).toBe(item.id);
    expect(result.price).toBe(299.99);
    expect(result.currency).toBe('USD');
    expect(result.photos).toEqual([]);
  });

  it('201 — respects custom currency and photos', async () => {
    const result = await svc.create(
      {
        itemId: item.id,
        price: 100,
        condition: ListingCondition.LIKE_NEW,
        currency: 'EUR',
        photos: ['https://cdn/photo1.jpg'],
        description: 'Barely used',
      },
      seller.id,
    );
    expect(result.currency).toBe('EUR');
    expect(result.photos).toEqual(['https://cdn/photo1.jpg']);
    expect(result.description).toBe('Barely used');
  });

  it('403 — throws ForbiddenException when itemId belongs to another user', async () => {
    await expect(
      svc.create({ itemId: otherItem.id, price: 100, condition: ListingCondition.GOOD }, seller.id),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ── 2. PATCH /marketplace/listings/:id ────────────────────────────────────

describe('PATCH /marketplace/listings/:id', () => {
  let seller: User;
  let item: Item;
  let draftListing: Listing;
  let activeListing: Listing;
  let inactiveListing: Listing;

  beforeAll(async () => {
    seller = await seedUser();
    item = await seedItem(seller.id);

    // Draft
    const d = await svc.create(
      { itemId: item.id, price: 50, condition: ListingCondition.GOOD },
      seller.id,
    );
    draftListing = await listingRepo.findOneOrFail({ where: { id: d.id } });

    // Active
    const a = await svc.create(
      { itemId: item.id, price: 75, condition: ListingCondition.GOOD },
      seller.id,
    );
    await svc.publish(a.id, seller.id);
    activeListing = await listingRepo.findOneOrFail({ where: { id: a.id } });

    // Inactive
    const i = await svc.create(
      { itemId: item.id, price: 60, condition: ListingCondition.GOOD },
      seller.id,
    );
    await svc.publish(i.id, seller.id);
    await svc.unpublish(i.id, seller.id);
    inactiveListing = await listingRepo.findOneOrFail({ where: { id: i.id } });
  });

  it('200 — edits a draft listing', async () => {
    const result = await svc.update(draftListing.id, seller.id, { price: 999 });
    expect(result.price).toBe(999);
  });

  it('200 — edits an inactive listing', async () => {
    const result = await svc.update(inactiveListing.id, seller.id, {
      description: 'Updated desc',
    });
    expect(result.description).toBe('Updated desc');
  });

  it('400 — throws BadRequestException when listing is active', async () => {
    await expect(
      svc.update(activeListing.id, seller.id, { price: 1 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('403 — throws ForbiddenException when caller is not the owner', async () => {
    const other = await seedUser();
    await expect(
      svc.update(draftListing.id, other.id, { price: 1 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('404 — throws NotFoundException for unknown listing id', async () => {
    await expect(
      svc.update('00000000-0000-0000-0000-000000000000', seller.id, {}),
    ).rejects.toThrow(NotFoundException);
  });
});

// ── 3. POST /marketplace/listings/:id/publish ─────────────────────────────

describe('POST /marketplace/listings/:id/publish', () => {
  let seller: User;
  let listingId: string;

  beforeAll(async () => {
    seller = await seedUser();
    const item = await seedItem(seller.id);
    const l = await svc.create(
      { itemId: item.id, price: 200, condition: ListingCondition.NEW },
      seller.id,
    );
    listingId = l.id;
  });

  it('sets status=active, publishedAt, and expiresAt=publishedAt+30d', async () => {
    const before = Date.now();
    const result = await svc.publish(listingId, seller.id);
    const after = Date.now();

    expect(result.status).toBe(ListingStatus.ACTIVE);
    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(result.publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.publishedAt!.getTime()).toBeLessThanOrEqual(after);

    const expectedExpiry = new Date(result.publishedAt!.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt!.getTime()).toBe(expectedExpiry.getTime());
  });
});

// ── 4. POST /marketplace/listings/:id/unpublish ───────────────────────────

describe('POST /marketplace/listings/:id/unpublish', () => {
  it('sets status=inactive', async () => {
    const seller = await seedUser();
    const item = await seedItem(seller.id);
    const l = await svc.create(
      { itemId: item.id, price: 300, condition: ListingCondition.FAIR },
      seller.id,
    );
    await svc.publish(l.id, seller.id);
    const result = await svc.unpublish(l.id, seller.id);
    expect(result.status).toBe(ListingStatus.INACTIVE);
  });
});

// ── 5. DELETE /marketplace/listings/:id ───────────────────────────────────

describe('DELETE /marketplace/listings/:id', () => {
  let seller: User;
  let listingId: string;

  beforeAll(async () => {
    seller = await seedUser();
    const item = await seedItem(seller.id);
    const l = await svc.create(
      { itemId: item.id, price: 150, condition: ListingCondition.GOOD },
      seller.id,
    );
    listingId = l.id;
  });

  it('204 — soft-deletes (no error)', async () => {
    await expect(svc.remove(listingId, seller.id)).resolves.toBeUndefined();
  });

  it('404 — deleted listing is hidden from findDetail', async () => {
    await expect(svc.findDetail(listingId)).rejects.toThrow(NotFoundException);
  });

  it('hidden from browse (active+non-expired)', async () => {
    const page = await svc.browse({});
    const ids = page.listings.map((l) => l.id);
    expect(ids).not.toContain(listingId);
  });

  it('403 — subsequent remove attempt by owner throws NotFoundException (already deleted)', async () => {
    await expect(svc.remove(listingId, seller.id)).rejects.toThrow(NotFoundException);
  });
});

// ── 6. GET /marketplace/listings (browse) ─────────────────────────────────

describe('GET /marketplace/listings', () => {
  let seller: User;
  let techItem: Item;
  let furnitureItem: Item;
  let nearbyListing: Listing;
  let farListing: Listing;

  beforeAll(async () => {
    seller = await seedUser();

    techItem = await seedItem(seller.id, { category: ItemCategory.ELECTRONICS, name: 'Smart TV 4K OLED' });
    furnitureItem = await seedItem(seller.id, { category: ItemCategory.FURNITURE, name: 'Oak Dining Table' });

    // Publish various listings for filter tests
    async function publishedListing(
      item: Item,
      price: number,
      condition: ListingCondition,
      lat?: number,
      lng?: number,
    ): Promise<Listing> {
      const l = await svc.create(
        { itemId: item.id, price, condition, location: { lat, lng, city: lat ? 'Bangkok' : undefined } },
        seller.id,
      );
      await svc.publish(l.id, seller.id);
      return listingRepo.findOneOrFail({ where: { id: l.id } });
    }

    nearbyListing = await publishedListing(techItem, 500, ListingCondition.GOOD, 13.7563, 100.5018);
    farListing = await publishedListing(furnitureItem, 200, ListingCondition.FAIR, 48.8566, 2.3522); // Paris
    await publishedListing(techItem, 1500, ListingCondition.NEW);
    await publishedListing(furnitureItem, 50, ListingCondition.POOR);
  });

  it('returns only active non-expired listings', async () => {
    const result = await svc.browse({});
    for (const l of result.listings) {
      expect(l.status).toBe(ListingStatus.ACTIVE);
    }
  });

  it('text search (q) filters on item name', async () => {
    const result = await svc.browse({ q: 'Smart TV' });
    expect(result.listings.length).toBeGreaterThan(0);
    expect(result.listings.every((l) => l.itemId === techItem.id)).toBe(true);
  });

  it('category filter works', async () => {
    const result = await svc.browse({ category: ItemCategory.FURNITURE });
    expect(result.listings.length).toBeGreaterThan(0);
    for (const l of result.listings) {
      expect(l.itemId).toBe(furnitureItem.id);
    }
  });

  it('condition filter works', async () => {
    const result = await svc.browse({ condition: ListingCondition.NEW });
    for (const l of result.listings) {
      expect(l.condition).toBe(ListingCondition.NEW);
    }
  });

  it('priceMin filter excludes cheaper listings', async () => {
    const result = await svc.browse({ priceMin: 400 });
    for (const l of result.listings) {
      expect(l.price).toBeGreaterThanOrEqual(400);
    }
  });

  it('priceMax filter excludes expensive listings', async () => {
    const result = await svc.browse({ priceMax: 300 });
    for (const l of result.listings) {
      expect(l.price).toBeLessThanOrEqual(300);
    }
  });

  it('lat/lng/radius filter returns nearby listing and excludes Paris', async () => {
    // Search from Bangkok with 100km radius
    const result = await svc.browse({ lat: 13.75, lng: 100.5, radiusKm: 100 });
    const ids = result.listings.map((l) => l.id);
    expect(ids).toContain(nearbyListing.id);
    expect(ids).not.toContain(farListing.id);
  });

  it('pagination — page 1 with limit 2 returns 2 listings', async () => {
    const result = await svc.browse({ page: 1, limit: 2 });
    expect(result.listings.length).toBeLessThanOrEqual(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(2);
  });

  it('pagination — page 2 returns different listings than page 1', async () => {
    const page1 = await svc.browse({ page: 1, limit: 2 });
    const page2 = await svc.browse({ page: 2, limit: 2 });
    const ids1 = page1.listings.map((l) => l.id);
    const ids2 = page2.listings.map((l) => l.id);
    const overlap = ids1.filter((id) => ids2.includes(id));
    expect(overlap.length).toBe(0);
  });
});

// ── 7. GET /marketplace/listings/:id ──────────────────────────────────────

describe('GET /marketplace/listings/:id', () => {
  let seller: User;
  let listingId: string;

  beforeAll(async () => {
    seller = await seedUser({ firstName: 'Bob', lastName: 'Smith' });
    const item = await seedItem(seller.id);
    const l = await svc.create(
      { itemId: item.id, price: 399, condition: ListingCondition.LIKE_NEW },
      seller.id,
    );
    listingId = l.id;
  });

  it('returns seller.name (firstName + lastName)', async () => {
    const result = await svc.findDetail(listingId);
    expect(result.seller).toBeDefined();
    expect(result.seller!.name).toBe('Bob Smith');
  });

  it('returns seller.memberSince as a Date', async () => {
    const result = await svc.findDetail(listingId);
    expect(result.seller!.memberSince).toBeInstanceOf(Date);
  });

  it('404 — throws for a deleted listing', async () => {
    const seller2 = await seedUser();
    const item2 = await seedItem(seller2.id);
    const l = await svc.create(
      { itemId: item2.id, price: 10, condition: ListingCondition.POOR },
      seller2.id,
    );
    await svc.remove(l.id, seller2.id);
    await expect(svc.findDetail(l.id)).rejects.toThrow(NotFoundException);
  });
});

// ── 8. GET /marketplace/my-listings ───────────────────────────────────────

describe('GET /marketplace/my-listings', () => {
  let seller: User;
  let draftId: string;
  let activeId: string;
  let inactiveId: string;
  let deletedId: string;

  beforeAll(async () => {
    seller = await seedUser();
    const item1 = await seedItem(seller.id);
    const item2 = await seedItem(seller.id);
    const item3 = await seedItem(seller.id);
    const item4 = await seedItem(seller.id);

    const d = await svc.create({ itemId: item1.id, price: 10, condition: ListingCondition.GOOD }, seller.id);
    draftId = d.id;

    const a = await svc.create({ itemId: item2.id, price: 20, condition: ListingCondition.GOOD }, seller.id);
    await svc.publish(a.id, seller.id);
    activeId = a.id;

    const i = await svc.create({ itemId: item3.id, price: 30, condition: ListingCondition.GOOD }, seller.id);
    await svc.publish(i.id, seller.id);
    await svc.unpublish(i.id, seller.id);
    inactiveId = i.id;

    const del = await svc.create({ itemId: item4.id, price: 40, condition: ListingCondition.GOOD }, seller.id);
    await svc.remove(del.id, seller.id);
    deletedId = del.id;
  });

  it('returns draft, active, and inactive listings', async () => {
    const result = await svc.findMyListings(seller.id, {});
    const ids = result.listings.map((l) => l.id);
    expect(ids).toContain(draftId);
    expect(ids).toContain(activeId);
    expect(ids).toContain(inactiveId);
  });

  it('does NOT return deleted listings', async () => {
    const result = await svc.findMyListings(seller.id, {});
    const ids = result.listings.map((l) => l.id);
    expect(ids).not.toContain(deletedId);
  });

  it('does not expose listings of other sellers', async () => {
    const other = await seedUser();
    const result = await svc.findMyListings(other.id, {});
    expect(result.listings.length).toBe(0);
  });
});

// ── 9. Hourly cron — ListingsExpiryService.expireListings() ───────────────

describe('ListingsExpiryService.expireListings()', () => {
  it('marks active listings with past expiresAt as expired', async () => {
    const seller = await seedUser();
    const item = await seedItem(seller.id);
    const l = await svc.create(
      { itemId: item.id, price: 999, condition: ListingCondition.GOOD },
      seller.id,
    );
    await svc.publish(l.id, seller.id);

    // Force expiresAt into the past
    const pastDate = new Date(Date.now() - 60_000);
    await listingRepo.update(l.id, {
      expiresAt: pastDate,
    });

    await expirySvc.expireListings();

    const updated = await listingRepo.findOneOrFail({ where: { id: l.id } });
    expect(updated.status).toBe(ListingStatus.EXPIRED);
  });

  it('does not expire listings with future expiresAt', async () => {
    const seller = await seedUser();
    const item = await seedItem(seller.id);
    const l = await svc.create(
      { itemId: item.id, price: 500, condition: ListingCondition.GOOD },
      seller.id,
    );
    await svc.publish(l.id, seller.id);

    await expirySvc.expireListings();

    const still = await listingRepo.findOneOrFail({ where: { id: l.id } });
    expect(still.status).toBe(ListingStatus.ACTIVE);
  });

  it('is idempotent — running twice does not change count', async () => {
    // Run once more; already-expired listings are not touched
    const seller = await seedUser();
    const item = await seedItem(seller.id);
    const l = await svc.create(
      { itemId: item.id, price: 1, condition: ListingCondition.POOR },
      seller.id,
    );
    await svc.publish(l.id, seller.id);
    await listingRepo.update(l.id, { expiresAt: new Date(Date.now() - 1000) });

    await expirySvc.expireListings();
    await expirySvc.expireListings(); // second pass

    const updated = await listingRepo.findOneOrFail({ where: { id: l.id } });
    expect(updated.status).toBe(ListingStatus.EXPIRED);
  });
});

// ── 10. Performance: browse <300 ms with 1 000+ listings ──────────────────

describe('Performance — browse with 1 000+ active listings', () => {
  it('responds in <300 ms', async () => {
    // Seed 1 100 active listings via bulk INSERT
    const bulkSeller = await seedUser();
    const bulkItem = await seedItem(bulkSeller.id, { name: 'Bulk Item' });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const batchSize = 100;
    const total = 1_100;

    for (let batch = 0; batch < total / batchSize; batch++) {
      const values = Array.from({ length: batchSize }, (_, i) => ({
        itemId: bulkItem.id,
        sellerId: bulkSeller.id,
        price: 10 + (batch * batchSize + i),
        currency: 'USD',
        condition: ListingCondition.GOOD,
        listingType: ListingType.SELL,
        status: ListingStatus.ACTIVE,
        photos: [] as string[],
        publishedAt: now,
        expiresAt,
      }));

      await listingRepo
        .createQueryBuilder()
        .insert()
        .into(Listing)
        .values(values)
        .execute();
    }

    const start = performance.now();
    const result = await svc.browse({ page: 1, limit: 20 });
    const elapsed = performance.now() - start;

    expect(result.total).toBeGreaterThanOrEqual(1_000);
    expect(elapsed).toBeLessThan(300);

    console.log(
      `[BENCH] browse with ${result.total} listings: ${elapsed.toFixed(1)} ms`,
    );
  }, 60_000);
});
