import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RemindersService } from './reminders.service';
import { FirebaseService } from './firebase.service';
import { ExpoNotificationsService } from './expo-notifications.service';
import { Notification } from './entities/notification.entity';
import { decryptToken } from '../common/crypto.util';

const DAYS_AHEAD = 3;

@Injectable()
export class MaintenanceJobService {
  private readonly logger = new Logger(MaintenanceJobService.name);

  constructor(
    private readonly remindersService: RemindersService,
    private readonly firebaseService: FirebaseService,
    private readonly expoNotifications: ExpoNotificationsService,
    @InjectRepository(Notification)
    private readonly notificationsRepo: Repository<Notification>,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDueReminders(): Promise<void> {
    this.logger.log(`Running daily maintenance reminder check (within ${DAYS_AHEAD} days)`);

    const reminders = await this.remindersService.findUpcomingWithUsers(DAYS_AHEAD);
    this.logger.log(`Found ${reminders.length} upcoming reminders`);

    const encryptionKey = this.config.get<string>('PUSH_TOKEN_ENCRYPTION_KEY');

    for (const reminder of reminders) {
      const user = reminder.item?.user;
      if (!user) continue;

      const daysUntilDue = this.daysUntilDue(reminder.nextDueAt);
      const title = `Maintenance due: ${reminder.title}`;
      const body =
        daysUntilDue <= 0
          ? `${reminder.item.name} maintenance is overdue`
          : `${reminder.item.name} needs maintenance in ${daysUntilDue} day(s)`;

      await this.notificationsRepo.save(
        this.notificationsRepo.create({
          userId: user.id,
          title,
          body,
          type: 'maintenance_reminder',
          referenceId: reminder.id,
          isRead: false,
        }),
      );

      const pushData = {
        reminderId: reminder.id,
        itemId: reminder.itemId,
        itemName: reminder.item.name,
      };

      if (user.pushToken && encryptionKey?.length === 64) {
        try {
          const plainToken = decryptToken(user.pushToken, encryptionKey);
          await this.expoNotifications.sendToDevice(plainToken, { title, body, data: pushData });
        } catch (err) {
          this.logger.error(`Failed to decrypt/send Expo push for user ${user.id}`, err);
        }
      } else if (user.fcmToken) {
        await this.firebaseService.sendToDevice(user.fcmToken, { title, body, data: pushData });
      }
    }

    this.logger.log(`Reminder notifications dispatched for ${reminders.length} reminders`);
  }

  private daysUntilDue(nextDueAt: Date): number {
    const now = new Date();
    const diff = nextDueAt.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
