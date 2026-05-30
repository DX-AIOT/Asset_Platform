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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RemindersService } from './reminders.service';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CompleteReminderDto } from './dto/complete-reminder.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MaintenanceReminder } from './entities/maintenance-reminder.entity';
import { MaintenanceRecord } from './entities/maintenance-record.entity';
import { UsersService } from '../users/users.service';

@ApiTags('reminders')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly usersService: UsersService,
  ) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Update a maintenance reminder' })
  @ApiParam({ name: 'id', description: 'Reminder UUID' })
  @ApiResponse({ status: 200, description: 'Updated reminder.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Reminder not found.' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateReminderDto,
  ): Promise<MaintenanceReminder> {
    return this.remindersService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a maintenance reminder' })
  @ApiParam({ name: 'id', description: 'Reminder UUID' })
  @ApiResponse({ status: 204, description: 'Reminder deleted.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Reminder not found.' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.remindersService.remove(id, user.id);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Mark a maintenance reminder as completed',
    description: 'Creates a maintenance record and advances nextDueAt by the reminder\'s intervalDays.',
  })
  @ApiParam({ name: 'id', description: 'Reminder UUID' })
  @ApiResponse({ status: 201, description: 'Maintenance record created.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Reminder not found.' })
  complete(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CompleteReminderDto,
  ): Promise<MaintenanceRecord> {
    return this.remindersService.complete(id, user.id, dto);
  }

  @Put('device-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Register or update FCM device token for push notifications',
    description: 'Associates the FCM token with the authenticated user so the maintenance job can send push notifications.',
  })
  @ApiResponse({ status: 204, description: 'Token registered.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async registerDeviceToken(
    @CurrentUser() user: any,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<void> {
    await this.usersService.update(user.id, { fcmToken: dto.fcmToken });
  }
}
