import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { SharingModule } from './sharing/sharing.module';
import { ReportsModule } from './reports/reports.module';
import { RemindersModule } from './reminders/reminders.module';
import { DatabaseSeedService } from './database/database-seed.service';
import { User } from './users/entities/user.entity';
import { Item } from './items/entities/item.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: ['development', 'staging'].includes(process.env.NODE_ENV || ''),
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([User, Item]),
    AiModule,
    AuthModule,
    UsersModule,
    ItemsModule,
    SharingModule,
    ReportsModule,
    RemindersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseSeedService,
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
