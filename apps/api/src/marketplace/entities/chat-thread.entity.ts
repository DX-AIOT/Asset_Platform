import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Listing } from './listing.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('marketplace_chat_threads')
@Index(['listingId', 'buyerId'], { unique: true })
export class ChatThread {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing!: Listing;

  @Column()
  listingId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyerId' })
  buyer!: User;

  @Column()
  buyerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller!: User;

  @Column()
  sellerId!: string;

  @OneToMany(() => ChatMessage, (msg) => msg.thread)
  messages!: ChatMessage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
