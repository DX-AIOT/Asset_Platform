import { SharePermission, ShareStatus } from '../entities/family-share.entity';

export class ShareMemberDto {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  permission: SharePermission;
  status: ShareStatus;
  sharedAt: Date;
}

export class SharedInventoryDto {
  shareId: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  permission: SharePermission;
  sharedAt: Date;
}

export class InviteResponseDto {
  id: string;
  sharedWithEmail: string;
  permission: SharePermission;
  status: ShareStatus;
  expiresAt: Date;
}
