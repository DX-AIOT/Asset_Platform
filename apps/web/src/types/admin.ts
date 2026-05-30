export type TransactionStatus = 'DISPUTED' | 'HELD' | 'RELEASED' | 'REFUNDED';
export type ResolutionSide = 'buyer' | 'seller';

export interface AdminTransaction {
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

export interface AdminTransactionsResponse {
  transactions: AdminTransaction[];
  total: number;
}
