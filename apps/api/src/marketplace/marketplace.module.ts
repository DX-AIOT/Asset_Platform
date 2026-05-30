import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { Transaction } from './entities/transaction.entity';
import { ChatThread } from './entities/chat-thread.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Review } from './entities/review.entity';
import { Item } from '../items/entities/item.entity';
import { ListingsService } from './listings.service';
import { ListingsExpiryService } from './listings-expiry.service';
import { ListingsController } from './listings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, Transaction, ChatThread, ChatMessage, Review, Item]),
  ],
  controllers: [ListingsController],
  providers: [ListingsService, ListingsExpiryService],
  exports: [TypeOrmModule, ListingsService],
})
export class MarketplaceModule {}
