import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Item } from './item.entity';

export enum PriceHistorySource {
  MANUAL = 'manual',
  AI = 'ai',
  MARKET = 'market',
}

/**
 * Append-only time-series of an asset's estimated value. One row per recorded
 * snapshot (on creation, on condition change, or on-demand). Rows are never
 * mutated — trend is derived at read time from the ordered series.
 */
@Entity('price_history')
@Index('idx_price_history_item_recorded', ['itemId', 'recordedAt'])
export class PriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Item, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item!: Item;

  @Column()
  itemId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  estimatedValue!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: PriceHistorySource,
    default: PriceHistorySource.AI,
  })
  source!: PriceHistorySource;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  recordedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
