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

export enum ItemCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

export enum ItemCategory {
  ELECTRONICS = 'electronics',
  MOBILE_PHONES = 'mobile_phones',
  LAPTOPS = 'laptops',
  VEHICLES = 'vehicles',
  FURNITURE = 'furniture',
  APPLIANCES = 'appliances',
  OTHER = 'other',
}

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  brand: string;

  @Column({ nullable: true })
  model: string;

  @Column({
    type: 'enum',
    enum: ItemCategory,
    default: ItemCategory.OTHER,
  })
  category: ItemCategory;

  @Column({ nullable: true })
  serial: string;

  @Column({ type: 'date', nullable: true })
  purchaseDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  purchasePrice: number;

  @Column({
    type: 'enum',
    enum: ItemCondition,
    default: ItemCondition.GOOD,
  })
  condition: ItemCondition;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'jsonb', nullable: true })
  photos: string[];

  @Column({ type: 'date', nullable: true })
  warrantyExpiry: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  depreciatedValue: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
