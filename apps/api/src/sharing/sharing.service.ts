import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { FamilyShare, SharePermission, ShareStatus } from './entities/family-share.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { InviteDto } from './dto/invite.dto';
import {
  InviteResponseDto,
  ShareMemberDto,
  SharedInventoryDto,
} from './dto/sharing-response.dto';

@Injectable()
export class SharingService {
  constructor(
    @InjectRepository(FamilyShare)
    private shareRepo: Repository<FamilyShare>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  async invite(ownerId: string, dto: InviteDto): Promise<InviteResponseDto> {
    const owner = await this.userRepo.findOneBy({ id: ownerId });
    if (!owner) throw new NotFoundException('Owner not found');

    if (owner.email === dto.email) {
      throw new BadRequestException('Cannot share with yourself');
    }

    // Check for an existing non-revoked share for this email
    const existing = await this.shareRepo.findOne({
      where: { ownerId, sharedWithEmail: dto.email },
    });

    if (existing) {
      if (existing.status === ShareStatus.ACTIVE) {
        throw new ConflictException('Already shared with this user');
      }
      if (existing.status === ShareStatus.PENDING) {
        // Reuse and refresh the token
        existing.token = this.generateToken();
        existing.permission = dto.permission ?? SharePermission.VIEW;
        existing.expiresAt = this.inviteExpiry();
        const saved = await this.shareRepo.save(existing);
        await this.dispatchInviteEmail(saved, owner, dto.email);
        return this.toInviteResponse(saved);
      }
      // Revoked — allow re-invite by creating a fresh record
      await this.shareRepo.remove(existing);
    }

    const share = this.shareRepo.create({
      ownerId,
      sharedWithEmail: dto.email,
      permission: dto.permission ?? SharePermission.VIEW,
      status: ShareStatus.PENDING,
      token: this.generateToken(),
      expiresAt: this.inviteExpiry(),
    });

    const saved = await this.shareRepo.save(share);
    await this.dispatchInviteEmail(saved, owner, dto.email);
    return this.toInviteResponse(saved);
  }

  async acceptInvite(token: string): Promise<{ message: string }> {
    const share = await this.shareRepo.findOne({
      where: { token, status: ShareStatus.PENDING },
      relations: ['owner'],
    });

    if (!share) throw new NotFoundException('Invite not found or already used');

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new BadRequestException('Invite has expired');
    }

    // Find the user account for the invited email (if they have one)
    const invitee = await this.userRepo.findOneBy({ email: share.sharedWithEmail });

    share.status = ShareStatus.ACTIVE;
    share.sharedWithUserId = invitee?.id ?? null;
    await this.shareRepo.save(share);

    const ownerName = [share.owner.firstName, share.owner.lastName].filter(Boolean).join(' ') || share.owner.email;
    return { message: `You now have access to ${ownerName}'s inventory.` };
  }

  async listMembers(ownerId: string): Promise<ShareMemberDto[]> {
    const shares = await this.shareRepo.find({
      where: { ownerId },
      relations: ['sharedWithUser'],
      order: { createdAt: 'DESC' },
    });

    return shares.map((s) => ({
      userId: s.sharedWithUserId,
      email: s.sharedWithUser?.email ?? s.sharedWithEmail,
      firstName: s.sharedWithUser?.firstName ?? '',
      lastName: s.sharedWithUser?.lastName ?? '',
      permission: s.permission,
      status: s.status,
      sharedAt: s.createdAt,
    }));
  }

  async revokeAccess(ownerId: string, targetUserId: string): Promise<void> {
    const share = await this.shareRepo.findOne({
      where: { ownerId, sharedWithUserId: targetUserId },
    });

    if (!share) throw new NotFoundException('Share not found');

    share.status = ShareStatus.REVOKED;
    await this.shareRepo.save(share);
  }

  async listSharedWithMe(userId: string): Promise<SharedInventoryDto[]> {
    const shares = await this.shareRepo.find({
      where: { sharedWithUserId: userId, status: ShareStatus.ACTIVE },
      relations: ['owner'],
      order: { updatedAt: 'DESC' },
    });

    return shares.map((s) => ({
      shareId: s.id,
      ownerUserId: s.ownerId,
      ownerEmail: s.owner.email,
      ownerFirstName: s.owner.firstName ?? '',
      ownerLastName: s.owner.lastName ?? '',
      permission: s.permission,
      sharedAt: s.updatedAt,
    }));
  }

  /** Verify that userId has active access to ownerId's inventory. */
  async assertAccessTo(userId: string, ownerId: string): Promise<FamilyShare> {
    const share = await this.shareRepo.findOne({
      where: { ownerId, sharedWithUserId: userId, status: ShareStatus.ACTIVE },
    });
    if (!share) throw new NotFoundException('No active share found for this inventory');
    return share;
  }

  // --- helpers ---

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private inviteExpiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }

  private async dispatchInviteEmail(share: FamilyShare, owner: User, toEmail: string): Promise<void> {
    const appUrl = this.config.get<string>('APP_URL', 'https://app.aiot-asset.app');
    const acceptUrl = `${appUrl}/sharing/accept/${share.token}`;
    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email;

    await this.mail.sendShareInvite({ toEmail, ownerName, acceptUrl });
  }

  private toInviteResponse(share: FamilyShare): InviteResponseDto {
    return {
      id: share.id,
      sharedWithEmail: share.sharedWithEmail,
      permission: share.permission,
      status: share.status,
      expiresAt: share.expiresAt,
    };
  }
}
