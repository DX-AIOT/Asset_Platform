import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MaintenanceReminder } from './entities/maintenance-reminder.entity';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetRemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post(':id/reminders')
  create(
    @Param('id') itemId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateReminderDto,
  ): Promise<MaintenanceReminder> {
    return this.remindersService.create(itemId, user.id, dto);
  }

  @Get(':id/reminders')
  findByItem(
    @Param('id') itemId: string,
    @CurrentUser() user: any,
  ): Promise<MaintenanceReminder[]> {
    return this.remindersService.findByItem(itemId, user.id);
  }
}
