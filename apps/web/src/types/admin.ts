export type TransactionStatus =
  | 'disputed'
  | 'escrow_held'
  | 'released_to_seller'
  | 'buyer_refunded'
  | 'pending_payment'
  | 'payment_failed'
  | 'release_failed';

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
