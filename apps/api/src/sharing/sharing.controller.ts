import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SharingService } from './sharing.service';
import { InviteDto } from './dto/invite.dto';
import {
  InviteResponseDto,
  ShareMemberDto,
  SharedInventoryDto,
} from './dto/sharing-response.dto';

@ApiTags('sharing')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@Controller('sharing')
@UseGuards(JwtAuthGuard)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite a user to access your inventory',
    description: 'Sends an email invite with a signed token. The recipient must visit /sharing/invites/:token/accept to activate access.',
  })
  @ApiResponse({ status: 201, description: 'Invite created and email dispatched.', type: InviteResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async invite(
    @CurrentUser() user: any,
    @Body() dto: InviteDto,
  ): Promise<InviteResponseDto> {
    return this.sharingService.invite(user.id, dto);
  }

  @Get('invites/:token/accept')
  @Public()
  @ApiOperation({
    summary: 'Accept a share invite via emailed token',
    description: 'Public endpoint — recipients click this link from their email. Creates the share relationship and marks the invite as active.',
  })
  @ApiParam({ name: 'token', description: 'Signed invite token from the email' })
  @ApiResponse({ status: 200, description: 'Invite accepted.' })
  @ApiResponse({ status: 404, description: 'Token not found or already used.' })
  async acceptInvite(@Param('token') token: string): Promise<{ message: string }> {
    return this.sharingService.acceptInvite(token);
  }

  @Get('members')
  @ApiOperation({ summary: 'List users with access to your inventory' })
  @ApiResponse({ status: 200, description: 'List of share members (pending and active).', type: [ShareMemberDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async listMembers(@CurrentUser() user: any): Promise<ShareMemberDto[]> {
    return this.sharingService.listMembers(user.id);
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke inventory access for a specific user' })
  @ApiParam({ name: 'userId', description: 'UUID of the user whose access to revoke' })
  @ApiResponse({ status: 204, description: 'Access revoked.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async revokeAccess(
    @CurrentUser() user: any,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    return this.sharingService.revokeAccess(user.id, targetUserId);
  }

  @Get('shared-with-me')
  @ApiOperation({ summary: 'List inventories shared with you by other users' })
  @ApiResponse({ status: 200, description: 'List of shared inventories.', type: [SharedInventoryDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async sharedWithMe(@CurrentUser() user: any): Promise<SharedInventoryDto[]> {
    return this.sharingService.listSharedWithMe(user.id);
  }
}
