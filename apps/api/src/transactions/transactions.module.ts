import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { DisputeRecord } from './entities/dispute-record.entity';
import { Listing } from '../marketplace/entities/listing.entity';
import { PaymentGatewayModule } from '../payments/payment-gateway.module';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { EscrowReleaseService } from './escrow-release.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, DisputeRecord, Listing]),
    PaymentGatewayModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, EscrowReleaseService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
