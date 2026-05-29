import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MaintenanceReminder } from './maintenance-reminder.entity';

@Entity('maintenance_records')
export class MaintenanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MaintenanceReminder, (reminder) => reminder.records, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reminderId' })
  reminder!: MaintenanceReminder;

  @Column()
  reminderId!: string;

  @Column({ type: 'timestamptz' })
  completedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  cost!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
