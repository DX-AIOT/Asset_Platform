import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { SharingModule } from './sharing/sharing.module';
import { ReportsModule } from './reports/reports.module';
import { RemindersModule } from './reminders/reminders.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PaymentGatewayModule } from './payments/payment-gateway.module';
import { DatabaseSeedService } from './database/database-seed.service';
import { User } from './users/entities/user.entity';
import { Item } from './items/entities/item.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_GLOBAL_TTL_MS', 60_000),
            limit: config.get<number>('THROTTLE_GLOBAL_LIMIT', 100),
          },
        ],
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: ['development', 'staging'].includes(config.get<string>('NODE_ENV') || ''),
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([User, Item]),
    AiModule,
    AuthModule,
    UsersModule,
    ItemsModule,
    SharingModule,
    ReportsModule,
    RemindersModule,
    MarketplaceModule,
    TransactionsModule,
    PaymentGatewayModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseSeedService,
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
