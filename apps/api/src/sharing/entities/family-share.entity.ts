import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SharePermission {
  VIEW = 'view',
  EDIT = 'edit',
}

export enum ShareStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

@Entity('family_shares')
@Index(['ownerId', 'sharedWithEmail'], { unique: true, where: "status != 'revoked'" })
export class FamilyShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'varchar', nullable: true })
  sharedWithUserId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sharedWithUserId' })
  sharedWithUser: User;

  @Column()
  sharedWithEmail: string;

  @Column({
    type: 'enum',
    enum: SharePermission,
    default: SharePermission.VIEW,
  })
  permission: SharePermission;

  @Column({
    type: 'enum',
    enum: ShareStatus,
    default: ShareStatus.PENDING,
  })
  status: ShareStatus;

  @Column({ unique: true })
  token: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
