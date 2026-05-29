import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ChatThread } from './chat-thread.entity';

@Entity('marketplace_chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ChatThread, (thread) => thread.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread!: ChatThread;

  @Column()
  threadId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @Column()
  senderId!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
