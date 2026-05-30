import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceReminder } from './entities/maintenance-reminder.entity';
import { MaintenanceRecord } from './entities/maintenance-record.entity';
import { Notification } from './entities/notification.entity';
import { Item } from '../items/entities/item.entity';
import { RemindersService } from './reminders.service';
import { FirebaseService } from './firebase.service';
import { ExpoNotificationsService } from './expo-notifications.service';
import { MaintenanceJobService } from './maintenance-job.service';
import { AssetRemindersController } from './asset-reminders.controller';
import { RemindersController } from './reminders.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenanceReminder, MaintenanceRecord, Notification, Item]),
    UsersModule,
  ],
  controllers: [AssetRemindersController, RemindersController],
  providers: [RemindersService, FirebaseService, ExpoNotificationsService, MaintenanceJobService],
  exports: [RemindersService, FirebaseService, ExpoNotificationsService],
})
export class RemindersModule {}
