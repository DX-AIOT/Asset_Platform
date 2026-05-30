import {
  Controller,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { encryptToken } from '../common/crypto.util';

@ApiTags('users')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Patch('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Register or update Expo push token',
    description:
      'Stores the Expo push token for the authenticated user. ' +
      'The token is AES-256-GCM encrypted before persistence.',
  })
  @ApiResponse({ status: 204, description: 'Push token registered.' })
  @ApiResponse({ status: 400, description: 'Invalid push token format.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async registerPushToken(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    const keyHex = this.config.get<string>('PUSH_TOKEN_ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== 64) {
      this.logger.warn('PUSH_TOKEN_ENCRYPTION_KEY not configured — push token not stored');
      return;
    }
    const encrypted = encryptToken(dto.pushToken, keyHex);
    await this.usersService.update(user.id, { pushToken: encrypted });
  }
}
