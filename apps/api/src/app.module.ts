import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
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
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseSeedService],
})
export class AppModule {}
