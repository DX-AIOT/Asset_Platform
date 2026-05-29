import {
  Controller,
  Patch,
  Delete,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Put,
} from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CompleteReminderDto } from './dto/complete-reminder.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MaintenanceReminder } from './entities/maintenance-reminder.entity';
import { MaintenanceRecord } from './entities/maintenance-record.entity';
import { UsersService } from '../users/users.service';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly usersService: UsersService,
  ) {}

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateReminderDto,
  ): Promise<MaintenanceReminder> {
    return this.remindersService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.remindersService.remove(id, user.id);
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CompleteReminderDto,
  ): Promise<MaintenanceRecord> {
    return this.remindersService.complete(id, user.id, dto);
  }

  @Put('device-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerDeviceToken(
    @CurrentUser() user: any,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<void> {
    await this.usersService.update(user.id, { fcmToken: dto.fcmToken });
  }
}
