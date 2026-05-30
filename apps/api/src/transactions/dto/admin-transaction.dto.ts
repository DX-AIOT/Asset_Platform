import { TransactionStatus } from '../entities/transaction.entity';

export class AdminTransactionDto {
  id: string;
  transactionId: string;
  listingTitle: string;
  buyerEmail: string;
  sellerEmail: string;
  amount: number;
  disputedAt: string | null;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
}

export class AdminTransactionsResponseDto {
  transactions: AdminTransactionDto[];
  total: number;
}
