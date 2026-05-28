import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { Item, ItemCategory, ItemCondition } from '../items/entities/item.entity';

async function seedDemo() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, Item],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const userRepo = dataSource.getRepository(User);
    const itemRepo = dataSource.getRepository(Item);

    // Create demo account
    let demoUser = await userRepo.findOne({
      where: { email: 'demo@dx-aiot.com' },
    });

    if (!demoUser) {
      const hashedPassword = await bcrypt.hash('Demo@123', 10);
      demoUser = userRepo.create({
        email: 'demo@dx-aiot.com',
        password: hashedPassword,
        firstName: 'Demo',
        lastName: 'User',
        role: UserRole.USER,
        isActive: true,
      });
      await userRepo.save(demoUser);
      console.log('✅ Demo user created: demo@dx-aiot.com / Demo@123');
    } else {
      console.log('ℹ️  Demo user already exists');
    }

    // Create 3 sample items: phone, laptop, motorcycle
    const items = [
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
        notes:
          'Deep Purple 256GB. Purchased from Apple Store. Original box and accessories included.',
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
        purchasePrice: 28500000, // VND equivalent ~1200 USD
        condition: ItemCondition.GOOD,
        location: 'Garage',
        photos: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
        warrantyExpiry: new Date('2025-06-10'),
        notes: 'Xe máy số tự động, màu đen. Đã chạy 15,000km. Bảo dưỡng định kỳ.',
        depreciatedValue: 22000000,
        userId: demoUser.id,
      },
    ];

    for (const itemData of items) {
      const existing = await itemRepo.findOne({
        where: {
          name: itemData.name,
          userId: demoUser.id,
        },
      });

      if (!existing) {
        const item = itemRepo.create(itemData);
        await itemRepo.save(item);
        console.log(`✅ Created item: ${itemData.name}`);
      } else {
        console.log(`ℹ️  Item already exists: ${itemData.name}`);
      }
    }

    console.log('\n✅ Demo seed data complete!');
    console.log('\n📋 Demo Account:');
    console.log('   Email: demo@dx-aiot.com');
    console.log('   Password: Demo@123');
    console.log('\n📦 Sample Items:');
    console.log('   1. iPhone 14 Pro');
    console.log('   2. MacBook Pro 16"');
    console.log('   3. Honda Wave Alpha 110');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedDemo();
