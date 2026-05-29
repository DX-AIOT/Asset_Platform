import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { Transaction } from './entities/transaction.entity';
import { ChatThread } from './entities/chat-thread.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Review } from './entities/review.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, Transaction, ChatThread, ChatMessage, Review]),
  ],
  exports: [TypeOrmModule],
})
export class MarketplaceModule {}
