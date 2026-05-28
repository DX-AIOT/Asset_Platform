import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item, ItemCategory } from './entities/item.entity';
import { ItemsListResponseDto, PortfolioValueResponseDto } from './dto';

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
