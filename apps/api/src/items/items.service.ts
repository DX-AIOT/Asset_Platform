import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item, ItemCategory } from './entities/item.entity';
import {
  DepreciationResponseDto,
  DepreciationYearPointDto,
  ItemsListResponseDto,
  PortfolioValueResponseDto,
} from './dto';

const CATEGORY_DEFAULT_RATES: Record<ItemCategory, number> = {
  [ItemCategory.ELECTRONICS]: 20,
  [ItemCategory.MOBILE_PHONES]: 20,
  [ItemCategory.LAPTOPS]: 20,
  [ItemCategory.VEHICLES]: 15,
  [ItemCategory.FURNITURE]: 10,
  [ItemCategory.APPLIANCES]: 12,
  [ItemCategory.OTHER]: 10,
};

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
  ) {}

  async findMyItems(
    userId: string,
    category?: ItemCategory,
    location?: string,
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

    const [items, total] = await queryBuilder
      .orderBy('item.createdAt', 'DESC')
      .getManyAndCount();

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

  async calculatePortfolioValue(
    userId: string,
  ): Promise<PortfolioValueResponseDto> {
    const items = await this.itemsRepository.find({
      where: { userId },
      select: ['purchasePrice', 'purchaseDate', 'depreciationRatePercent', 'category'],
    });

    const total = items.reduce(
      (sum, item) => sum + (Number(item.purchasePrice) || 0),
      0,
    );

    const depreciated = items.reduce((sum, item) => {
      const current = this.computeCurrentValue(item);
      return sum + (current ?? Number(item.purchasePrice) ?? 0);
    }, 0);

    return {
      total: Math.round(total * 100) / 100,
      depreciated: Math.round(depreciated * 100) / 100,
    };
  }

  async getDepreciation(
    id: string,
    userId: string,
  ): Promise<DepreciationResponseDto> {
    const item = await this.findOne(id, userId);

    if (!item.purchaseDate || !item.purchasePrice) {
      return {
        currentValue: null,
        percentLost: null,
        annualRatePercent: this.effectiveRate(item),
        valueHistory: [],
      };
    }

    const rate = this.effectiveRate(item);
    const purchasePrice = Number(item.purchasePrice);
    const purchaseYear = new Date(item.purchaseDate).getFullYear();
    const currentYear = new Date().getFullYear();

    const valueHistory: DepreciationYearPointDto[] = [];
    for (let yr = purchaseYear; yr <= currentYear; yr++) {
      const yearsElapsed = yr - purchaseYear;
      const value = Math.max(
        0,
        Math.round(purchasePrice * Math.pow(1 - rate / 100, yearsElapsed) * 100) / 100,
      );
      valueHistory.push({ year: yr, date: `${yr}-01-01`, value });
    }

    const currentValue = valueHistory[valueHistory.length - 1]?.value ?? purchasePrice;
    const percentLost =
      Math.round(((purchasePrice - currentValue) / purchasePrice) * 10000) / 100;

    return { currentValue, percentLost, annualRatePercent: rate, valueHistory };
  }

  private effectiveRate(item: Pick<Item, 'depreciationRatePercent' | 'category'>): number {
    if (item.depreciationRatePercent != null) {
      return Number(item.depreciationRatePercent);
    }
    return CATEGORY_DEFAULT_RATES[item.category] ?? 10;
  }

  private computeCurrentValue(
    item: Pick<Item, 'purchasePrice' | 'purchaseDate' | 'depreciationRatePercent' | 'category'>,
  ): number | null {
    if (!item.purchaseDate || !item.purchasePrice) return null;
    const rate = this.effectiveRate(item);
    const years = new Date().getFullYear() - new Date(item.purchaseDate).getFullYear();
    return Math.max(0, Math.round(Number(item.purchasePrice) * Math.pow(1 - rate / 100, years) * 100) / 100);
  }
}
