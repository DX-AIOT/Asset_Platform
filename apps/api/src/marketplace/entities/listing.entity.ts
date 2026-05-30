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
import { Item } from '../../items/entities/item.entity';

export enum ListingType {
  SELL = 'sell',
  RENT = 'rent',
  AUCTION = 'auction',
}

export enum ListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAUSED = 'paused',
  SOLD = 'sold',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
}

export enum ListingCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

@Entity('marketplace_listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Item, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item!: Item;

  @Column()
  itemId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller!: User;

  @Column()
  sellerId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: ListingCondition,
    default: ListingCondition.GOOD,
  })
  condition!: ListingCondition;

  @Column({
    type: 'enum',
    enum: ListingType,
    default: ListingType.SELL,
  })
  listingType!: ListingType;

  @Column({
    type: 'enum',
    enum: ListingStatus,
    default: ListingStatus.DRAFT,
  })
  status!: ListingStatus;

  @Column({ type: 'varchar', nullable: true })
  title!: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  photos!: string[];

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  @Column({ type: 'varchar', nullable: true })
  city!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
