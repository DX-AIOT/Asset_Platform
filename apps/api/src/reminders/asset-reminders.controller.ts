import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
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
import { CreateReminderDto } from './dto/create-reminder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MaintenanceReminder } from './entities/maintenance-reminder.entity';

@ApiTags('reminders')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetRemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post(':id/reminders')
  @ApiOperation({
    summary: 'Create a maintenance reminder for an asset',
    description: 'Sets up a recurring maintenance schedule. nextDueAt defaults to today + intervalDays if not specified.',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 201, description: 'Reminder created.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Asset not found.' })
  create(
    @Param('id') itemId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateReminderDto,
  ): Promise<MaintenanceReminder> {
    return this.remindersService.create(itemId, user.id, dto);
  }

  @Get(':id/reminders')
  @ApiOperation({ summary: 'List all maintenance reminders for an asset' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'List of reminders ordered by nextDueAt.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Asset not found.' })
  findByItem(
    @Param('id') itemId: string,
    @CurrentUser() user: any,
  ): Promise<MaintenanceReminder[]> {
    return this.remindersService.findByItem(itemId, user.id);
  }
}
