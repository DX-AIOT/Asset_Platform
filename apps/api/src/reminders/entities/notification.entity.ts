import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ default: 'maintenance_reminder' })
  type!: string;

  @Column({ type: 'varchar', nullable: true })
  referenceId!: string | null;

  @Column({ default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
