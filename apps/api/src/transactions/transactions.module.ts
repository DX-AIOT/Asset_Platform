import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { DisputeRecord } from './entities/dispute-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, DisputeRecord])],
  exports: [TypeOrmModule],
})
export class TransactionsModule {}
