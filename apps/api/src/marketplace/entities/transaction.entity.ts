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
import { Listing } from './listing.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  ESCROW = 'escrow',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
}

@Entity('marketplace_transactions')
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

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod!: string | null;

  @Column({ unique: true, nullable: true })
  momoOrderId!: string | null;

  @Column({ unique: true, nullable: true })
  momoRequestId!: string | null;

  @Column({ type: 'text', nullable: true })
  momoPaymentUrl!: string | null;

  @Column({ nullable: true })
  momoTransId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  escrowHeldAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  escrowReleasedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  disputeRaisedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  releaseAfter!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
