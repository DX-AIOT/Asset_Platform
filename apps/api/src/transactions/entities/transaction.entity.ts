import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Listing } from '../../marketplace/entities/listing.entity';

export enum TransactionStatus {
  PENDING_PAYMENT = 'pending_payment',
  ESCROW_HELD = 'escrow_held',
  RELEASED_TO_SELLER = 'released_to_seller',
  BUYER_REFUNDED = 'buyer_refunded',
  PAYMENT_FAILED = 'payment_failed',
  RELEASE_FAILED = 'release_failed',
  DISPUTED = 'disputed',
}

/** Valid FSM transitions: PENDING_PAYMENT → ESCROW_HELD | PAYMENT_FAILED
 *  ESCROW_HELD → RELEASED_TO_SELLER | BUYER_REFUNDED | RELEASE_FAILED | DISPUTED
 *  DISPUTED → RELEASED_TO_SELLER | BUYER_REFUNDED
 */
export const TRANSACTION_FSM: Readonly<Partial<Record<TransactionStatus, TransactionStatus[]>>> = {
  [TransactionStatus.PENDING_PAYMENT]: [
    TransactionStatus.ESCROW_HELD,
    TransactionStatus.PAYMENT_FAILED,
  ],
  [TransactionStatus.ESCROW_HELD]: [
    TransactionStatus.RELEASED_TO_SELLER,
    TransactionStatus.BUYER_REFUNDED,
    TransactionStatus.RELEASE_FAILED,
    TransactionStatus.DISPUTED,
  ],
  [TransactionStatus.DISPUTED]: [
    TransactionStatus.RELEASED_TO_SELLER,
    TransactionStatus.BUYER_REFUNDED,
  ],
};

@Entity('payment_transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing!: Listing;

  @Column()
  listingId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer!: User;

  @Column()
  buyerId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId' })
  seller!: User;

  @Column()
  sellerId!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  momoOrderId!: string | null;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING_PAYMENT,
  })
  status!: TransactionStatus;

  @Column({ type: 'bigint' })
  amountVND!: number;

  @Column({ type: 'timestamptz', nullable: true })
  escrowHeldAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  releasedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
