import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item, ItemCategory } from './entities/item.entity';
import { ItemsListResponseDto, PortfolioValueResponseDto, UpdateItemDto } from './dto';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>
  ) {}

  async findMyItems(
    userId: string,
    category?: ItemCategory,
    location?: string
  ): Promise<ItemsListResponseDto> {
    const queryBuilder = this.itemsRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId });

    if (category) {
      queryBuilder.andWhere('item.category = :category', { category });
    }

    if (location) {
      queryBuilder.andWhere('item.location ILIKE :location', {
        location: `%${location}%`,
      });
    }

    const [items, total] = await queryBuilder.orderBy('item.createdAt', 'DESC').getManyAndCount();

    return { items, total };
  }

  async findOne(id: string, userId: string): Promise<Item> {
    const item = await this.itemsRepository.findOne({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    return item;
  }

  async update(id: string, userId: string, dto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(id, userId);
    Object.assign(item, dto);
    return this.itemsRepository.save(item);
  }

  async getPriceHistory(id: string, userId: string) {
    const item = await this.findOne(id, userId);

    if (!item.purchasePrice || !item.purchaseDate) {
      return { points: [], latestValue: null, trends: null };
    }

    const purchaseDate = new Date(item.purchaseDate);
    const now = new Date();
    const purchaseValue = Number(item.purchasePrice);
    const currentValue = Number(item.depreciatedValue) || purchaseValue;

    const totalMs = now.getTime() - purchaseDate.getTime();
    const totalMonths = totalMs / (1000 * 60 * 60 * 24 * 30.44);

    if (totalMonths < 0) {
      return { points: [], latestValue: currentValue, trends: null };
    }

    const points: { date: string; value: number; source: string }[] = [];
    const cursor = new Date(purchaseDate);
    cursor.setDate(1);

    while (cursor <= now) {
      const elapsed = cursor.getTime() - purchaseDate.getTime();
      const fraction =
        totalMs > 0 ? Math.min(1, elapsed / totalMs) : 0;
      const value =
        Math.round((purchaseValue + (currentValue - purchaseValue) * fraction) * 100) / 100;
      points.push({ date: cursor.toISOString().split('T')[0], value, source: 'estimated' });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (points.length === 0) {
      return { points: [], latestValue: currentValue, trends: null };
    }

    const latest = points[points.length - 1].value;
    let trends = null;
    if (points.length >= 2) {
      const prev = points[points.length - 2].value;
      const changeAmount = Math.round((latest - prev) * 100) / 100;
      const changePercent =
        prev !== 0 ? Math.round(((latest - prev) / prev) * 10000) / 100 : 0;
      const direction = changeAmount > 0 ? 'up' : changeAmount < 0 ? 'down' : 'flat';
      trends = { changeAmount, changePercent, direction };
    }

    return { points, latestValue: latest, trends };
  }

  async calculatePortfolioValue(userId: string): Promise<PortfolioValueResponseDto> {
    const items = await this.itemsRepository.find({
      where: { userId },
      select: ['purchasePrice', 'depreciatedValue'],
    });

    const total = items.reduce((sum, item) => sum + (Number(item.purchasePrice) || 0), 0);

    const depreciated = items.reduce(
      (sum, item) => sum + (Number(item.depreciatedValue) || Number(item.purchasePrice) || 0),
      0
    );

    return {
      total: Math.round(total * 100) / 100,
      depreciated: Math.round(depreciated * 100) / 100,
    };
  }
}
