import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Item } from '../../items/entities/item.entity';
import type { MaintenanceRecord } from './maintenance-record.entity';

@Entity('maintenance_reminders')
export class MaintenanceReminder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Item, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item!: Item;

  @Column()
  itemId!: string;

  @Column()
  userId!: string;

  @Column()
  title!: string;

  @Column({ type: 'int' })
  intervalDays!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastCompletedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  nextDueAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  // Lazy require breaks circular dep: maintenance-record ↔ maintenance-reminder
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  @OneToMany(() => require('./maintenance-record.entity').MaintenanceRecord, (record: MaintenanceRecord) => record.reminder)
  records!: MaintenanceRecord[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
