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
import { Transaction } from './transaction.entity';

export enum DisputeStatus {
  OPEN = 'open',
  RESOLVED_BUYER = 'resolved_buyer',
  RESOLVED_SELLER = 'resolved_seller',
}

@Entity('dispute_records')
export class DisputeRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction!: Transaction;

  @Column()
  transactionId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'raisedByUserId' })
  raisedByUser!: User;

  @Column()
  raisedByUserId!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence!: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status!: DisputeStatus;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
