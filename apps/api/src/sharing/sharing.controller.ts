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

@Controller('sharing')
@UseGuards(JwtAuthGuard)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  /**
   * POST /sharing/invite
   * Send an invite to share the current user's inventory with another person.
   */
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @CurrentUser() user: any,
    @Body() dto: InviteDto,
  ): Promise<InviteResponseDto> {
    return this.sharingService.invite(user.id, dto);
  }

  /**
   * GET /sharing/invites/:token/accept
   * Accept a pending share invite via the token from the email link.
   * Public so recipients can click the link without being logged in first.
   */
  @Get('invites/:token/accept')
  @Public()
  async acceptInvite(@Param('token') token: string): Promise<{ message: string }> {
    return this.sharingService.acceptInvite(token);
  }

  /**
   * GET /sharing/members
   * List all users who have (or have been invited to have) access to my inventory.
   */
  @Get('members')
  async listMembers(@CurrentUser() user: any): Promise<ShareMemberDto[]> {
    return this.sharingService.listMembers(user.id);
  }

  /**
   * DELETE /sharing/members/:userId
   * Revoke access for a specific user.
   */
  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAccess(
    @CurrentUser() user: any,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    return this.sharingService.revokeAccess(user.id, targetUserId);
  }

  /**
   * GET /sharing/shared-with-me
   * List inventories that other users have shared with me.
   */
  @Get('shared-with-me')
  async sharedWithMe(@CurrentUser() user: any): Promise<SharedInventoryDto[]> {
    return this.sharingService.listSharedWithMe(user.id);
  }
}
