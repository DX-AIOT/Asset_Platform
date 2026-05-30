import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing, ListingStatus, ListingType } from './entities/listing.entity';
import { Item } from '../items/entities/item.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { BrowseListingsQueryDto, MyListingsQueryDto } from './dto/browse-listings-query.dto';
import {
  ListingResponseDto,
  ListingsPageDto,
  MyListingsPageDto,
  SellerSnippetDto,
} from './dto/listing-response.dto';

@Injectable()
export class ListingsService {
  private static readonly LISTING_EXPIRY_DAYS = 30;
  private static readonly MAX_PAGE_SIZE = 100;

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
  ) {}

  async create(dto: CreateListingDto, userId: string): Promise<ListingResponseDto> {
    const item = await this.itemRepo.findOne({ where: { id: dto.itemId, userId } });
    if (!item) {
      throw new ForbiddenException('Item not found or not owned by you');
    }

    const listing = this.listingRepo.create({
      itemId: dto.itemId,
      sellerId: userId,
      title: dto.title ?? item.name ?? null,
      price: dto.price,
      currency: dto.currency ?? 'USD',
      condition: dto.condition,
      description: dto.description ?? null,
      photos: dto.photos ?? [],
      listingType: dto.listingType ?? ListingType.SELL,
      lat: dto.location?.lat ?? null,
      lng: dto.location?.lng ?? null,
      city: dto.location?.city ?? null,
      location: dto.location?.city ?? null,
      status: ListingStatus.DRAFT,
    });

    const saved = await this.listingRepo.save(listing);
    return this.toDto(saved);
  }

  async update(id: string, userId: string, dto: UpdateListingDto): Promise<ListingResponseDto> {
    const listing = await this.findOwned(id, userId);

    if (listing.status !== ListingStatus.DRAFT && listing.status !== ListingStatus.INACTIVE) {
      throw new BadRequestException('Only draft or inactive listings can be edited');
    }

    if (dto.location !== undefined) {
      listing.lat = dto.location?.lat ?? null;
      listing.lng = dto.location?.lng ?? null;
      listing.city = dto.location?.city ?? null;
      listing.location = dto.location?.city ?? null;
    }

    const { location: _loc, ...rest } = dto;
    Object.assign(listing, rest);

    const saved = await this.listingRepo.save(listing);
    return this.toDto(saved);
  }

  async publish(id: string, userId: string): Promise<ListingResponseDto> {
    const listing = await this.findOwned(id, userId);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + ListingsService.LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    listing.status = ListingStatus.ACTIVE;
    listing.publishedAt = now;
    listing.expiresAt = expiresAt;

    const saved = await this.listingRepo.save(listing);
    return this.toDto(saved);
  }

  async unpublish(id: string, userId: string): Promise<ListingResponseDto> {
    const listing = await this.findOwned(id, userId);
    listing.status = ListingStatus.INACTIVE;
    const saved = await this.listingRepo.save(listing);
    return this.toDto(saved);
  }

  async remove(id: string, userId: string): Promise<void> {
    const listing = await this.findOwned(id, userId);
    listing.status = ListingStatus.DELETED;
    await this.listingRepo.save(listing);
  }

  async browse(query: BrowseListingsQueryDto): Promise<ListingsPageDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(query.limit ?? 20, ListingsService.MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const qb = this.listingRepo
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.seller', 'seller')
      .leftJoinAndSelect('listing.item', 'item')
      .where('listing.status = :status', { status: ListingStatus.ACTIVE })
      .andWhere('(listing."expiresAt" IS NULL OR listing."expiresAt" > NOW())');

    if (query.q) {
      qb.andWhere(
        '(listing.description ILIKE :q OR item.name ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    if (query.category) {
      qb.andWhere('item.category = :category', { category: query.category });
    }

    if (query.condition) {
      qb.andWhere('listing.condition = :condition', { condition: query.condition });
    }

    if (query.priceMin !== undefined) {
      qb.andWhere('listing.price >= :priceMin', { priceMin: query.priceMin });
    }

    if (query.priceMax !== undefined) {
      qb.andWhere('listing.price <= :priceMax', { priceMax: query.priceMax });
    }

    if (query.lat !== undefined && query.lng !== undefined) {
      const radiusKm = query.radiusKm ?? 50;
      qb.andWhere(
        `listing.lat IS NOT NULL
          AND listing.lng IS NOT NULL
          AND 6371 * acos(
            LEAST(1.0,
              cos(radians(:lat)) * cos(radians(listing.lat)) *
              cos(radians(listing.lng) - radians(:lng)) +
              sin(radians(:lat)) * sin(radians(listing.lat))
            )
          ) <= :radiusKm`,
        { lat: query.lat, lng: query.lng, radiusKm },
      );
    }

    const [listings, total] = await qb
      .orderBy('listing.publishedAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { listings: listings.map((l) => this.toDto(l)), total, page, limit };
  }

  async findDetail(id: string): Promise<ListingResponseDto> {
    const listing = await this.listingRepo
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.seller', 'seller')
      .leftJoinAndSelect('listing.item', 'item')
      .where('listing.id = :id', { id })
      .andWhere('listing.status != :deleted', { deleted: ListingStatus.DELETED })
      .getOne();

    if (!listing) {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    return this.toDto(listing);
  }

  async findMyListings(userId: string, query: MyListingsQueryDto): Promise<MyListingsPageDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(query.limit ?? 20, ListingsService.MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const [listings, total] = await this.listingRepo
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.item', 'item')
      .where('listing."sellerId" = :userId', { userId })
      .andWhere('listing.status != :deleted', { deleted: ListingStatus.DELETED })
      .orderBy('listing.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { listings: listings.map((l) => this.toDto(l)), total };
  }

  async markExpiredListings(): Promise<number> {
    const result = await this.listingRepo
      .createQueryBuilder()
      .update(Listing)
      .set({ status: ListingStatus.EXPIRED })
      .where('status = :status', { status: ListingStatus.ACTIVE })
      .andWhere('"expiresAt" IS NOT NULL')
      .andWhere('"expiresAt" <= NOW()')
      .execute();

    return result.affected ?? 0;
  }

  async findOwned(id: string, userId: string): Promise<Listing> {
    const listing = await this.listingRepo.findOne({ where: { id } });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You do not own this listing');
    }

    return listing;
  }

  private toDto(listing: Listing): ListingResponseDto {
    const dto = new ListingResponseDto();
    dto.id = listing.id;
    dto.itemId = listing.itemId;
    dto.sellerId = listing.sellerId;
    dto.title = listing.title ?? (listing as any).item?.name ?? null;
    dto.price = Number(listing.price);
    dto.currency = listing.currency;
    dto.condition = listing.condition;
    dto.listingType = listing.listingType;
    dto.status = listing.status;
    dto.photos = listing.photos;
    dto.description = listing.description;
    dto.location = listing.location;
    dto.lat = listing.lat;
    dto.lng = listing.lng;
    dto.city = listing.city;
    dto.publishedAt = listing.publishedAt;
    dto.expiresAt = listing.expiresAt;
    dto.createdAt = listing.createdAt;
    dto.updatedAt = listing.updatedAt;

    if (listing.seller) {
      const seller = new SellerSnippetDto();
      const u = listing.seller;
      seller.id = u.id;
      seller.name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
      seller.avatar = null;
      seller.memberSince = u.createdAt;
      dto.seller = seller;
    }

    return dto;
  }
}
