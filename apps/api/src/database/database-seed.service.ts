import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { Item, ItemCategory, ItemCondition } from '../items/entities/item.entity';
import { PriceHistorySource } from '../items/entities/price-history.entity';
import { PriceHistoryService } from '../ai/price-history.service';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    private readonly priceHistoryService: PriceHistoryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'staging') {
      return;
    }
    await this.seedDemoData();
  }

  private async seedDemoData(): Promise<void> {
    const existingCount = await this.userRepo.count({ where: { email: 'demo@dx-aiot.com' } });
    if (existingCount > 0) {
      this.logger.log('Demo data already present — skipping seed');
      return;
    }

    this.logger.log('Seeding demo data...');

    const hashedPassword = await bcrypt.hash('Demo@123', 10);
    const demoUser = this.userRepo.create({
      email: 'demo@dx-aiot.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      role: UserRole.USER,
      isActive: true,
    });
    await this.userRepo.save(demoUser);
    this.logger.log('Created demo user: demo@dx-aiot.com / Demo@123');

    const demoItems: Partial<Item>[] = [
      {
        name: 'iPhone 14 Pro',
        brand: 'Apple',
        model: 'A2890',
        category: ItemCategory.MOBILE_PHONES,
        serial: 'F17MH3QA1Y',
        purchaseDate: new Date('2023-09-20'),
        purchasePrice: 1199.0,
        condition: ItemCondition.LIKE_NEW,
        location: 'Home Office',
        photos: ['https://images.unsplash.com/photo-1663499482523-1c0a8b0b1f1f?w=800'],
        warrantyExpiry: new Date('2024-09-20'),
        notes: 'Deep Purple 256GB. Mua tại Apple Store. Kèm hộp và phụ kiện.',
        depreciatedValue: 899.0,
        userId: demoUser.id,
      },
      {
        name: 'MacBook Pro 16"',
        brand: 'Apple',
        model: 'M2 Max',
        category: ItemCategory.LAPTOPS,
        serial: 'C02ZL8QZMD6T',
        purchaseDate: new Date('2023-01-15'),
        purchasePrice: 3499.0,
        condition: ItemCondition.GOOD,
        location: 'Home Office',
        photos: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800'],
        warrantyExpiry: new Date('2026-01-15'),
        notes: 'M2 Max, 32GB RAM, 1TB SSD. AppleCare+ extended warranty.',
        depreciatedValue: 2799.0,
        userId: demoUser.id,
      },
      {
        name: 'Honda Wave Alpha 110',
        brand: 'Honda',
        model: 'Wave Alpha',
        category: ItemCategory.VEHICLES,
        serial: 'JH2KC14C7DK000123',
        purchaseDate: new Date('2022-06-10'),
        purchasePrice: 1200.0,
        condition: ItemCondition.GOOD,
        location: 'Garage',
        photos: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
        warrantyExpiry: new Date('2025-06-10'),
        notes: 'Xe máy số tự động, màu đen. Đã chạy 15,000km. Bảo dưỡng định kỳ.',
        depreciatedValue: 970.0,
        userId: demoUser.id,
      },
    ];

    for (const itemData of demoItems) {
      const item = this.itemRepo.create(itemData);
      await this.itemRepo.save(item);
      // Record an initial AI value snapshot on creation so each asset starts
      // with a price-history baseline (best-effort; never blocks seeding).
      await this.priceHistoryService.recordSnapshot(item, PriceHistorySource.AI);
      this.logger.log(`Created demo item: ${itemData.name}`);
    }

    this.logger.log('Demo seed complete: demo@dx-aiot.com / Demo@123 with 3 items');
  }
}
