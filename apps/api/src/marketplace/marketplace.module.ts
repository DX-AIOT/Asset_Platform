import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { Item } from '../items/entities/item.entity';
import { ListingsService } from './listings.service';
import { ListingsExpiryService } from './listings-expiry.service';
import { ListingsController } from './listings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, Item]),
  ],
  controllers: [ListingsController],
  providers: [ListingsService, ListingsExpiryService],
  exports: [TypeOrmModule, ListingsService],
})
export class MarketplaceModule {}
