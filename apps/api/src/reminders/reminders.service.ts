import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { MaintenanceReminder } from './entities/maintenance-reminder.entity';
import { MaintenanceRecord } from './entities/maintenance-record.entity';
import { Item } from '../items/entities/item.entity';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CompleteReminderDto } from './dto/complete-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(MaintenanceReminder)
    private readonly remindersRepo: Repository<MaintenanceReminder>,
    @InjectRepository(MaintenanceRecord)
    private readonly recordsRepo: Repository<MaintenanceRecord>,
    @InjectRepository(Item)
    private readonly itemsRepo: Repository<Item>,
  ) {}

  async create(
    itemId: string,
    userId: string,
    dto: CreateReminderDto,
  ): Promise<MaintenanceReminder> {
    const item = await this.itemsRepo.findOne({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);

    const nextDueAt = dto.nextDueAt
      ? new Date(dto.nextDueAt)
      : this.addDays(new Date(), dto.intervalDays);

    const reminder = this.remindersRepo.create({
      itemId,
      userId,
      title: dto.title,
      intervalDays: dto.intervalDays,
      notes: dto.notes ?? null,
      nextDueAt,
      lastCompletedAt: null,
    });
    return this.remindersRepo.save(reminder);
  }

  async findByItem(itemId: string, userId: string): Promise<MaintenanceReminder[]> {
    const item = await this.itemsRepo.findOne({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);

    return this.remindersRepo.find({
      where: { itemId, userId },
      order: { nextDueAt: 'ASC' },
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateReminderDto,
  ): Promise<MaintenanceReminder> {
    const reminder = await this.findOwnedReminder(id, userId);

    if (dto.title !== undefined) reminder.title = dto.title;
    if (dto.intervalDays !== undefined) reminder.intervalDays = dto.intervalDays;
    if (dto.nextDueAt !== undefined) reminder.nextDueAt = new Date(dto.nextDueAt);
    if (dto.notes !== undefined) reminder.notes = dto.notes;

    return this.remindersRepo.save(reminder);
  }

  async remove(id: string, userId: string): Promise<void> {
    const reminder = await this.findOwnedReminder(id, userId);
    await this.remindersRepo.remove(reminder);
  }

  async complete(
    id: string,
    userId: string,
    dto: CompleteReminderDto,
  ): Promise<MaintenanceRecord> {
    const reminder = await this.findOwnedReminder(id, userId);

    const completedAt = dto.completedAt ? new Date(dto.completedAt) : new Date();

    const record = this.recordsRepo.create({
      reminderId: reminder.id,
      completedAt,
      notes: dto.notes ?? null,
      cost: dto.cost ?? null,
    });
    await this.recordsRepo.save(record);

    reminder.lastCompletedAt = completedAt;
    reminder.nextDueAt = this.addDays(completedAt, reminder.intervalDays);
    await this.remindersRepo.save(reminder);

    return record;
  }

  async findUpcomingWithUsers(daysAhead: number): Promise<MaintenanceReminder[]> {
    const cutoff = this.addDays(new Date(), daysAhead);
    return this.remindersRepo.find({
      where: { nextDueAt: LessThanOrEqual(cutoff) },
      relations: ['item', 'item.user'],
    });
  }

  private async findOwnedReminder(id: string, userId: string): Promise<MaintenanceReminder> {
    const reminder = await this.remindersRepo.findOne({ where: { id } });
    if (!reminder) throw new NotFoundException(`Reminder ${id} not found`);
    if (reminder.userId !== userId) throw new ForbiddenException();
    return reminder;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
