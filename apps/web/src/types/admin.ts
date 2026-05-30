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
  listingId: string;
  buyerId: string;
  sellerId: string;
  amountVND: number;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
}
