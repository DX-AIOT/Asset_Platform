import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './entities/item.entity';
import { PriceHistory } from './entities/price-history.entity';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Item, PriceHistory]), AiModule, StorageModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [TypeOrmModule],
})
export class ItemsModule {}
