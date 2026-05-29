import { ApiProperty } from '@nestjs/swagger';
import { SharePermission, ShareStatus } from '../entities/family-share.entity';

export class ShareMemberDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ enum: SharePermission })
  permission: SharePermission;

  @ApiProperty({ enum: ShareStatus })
  status: ShareStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  sharedAt: Date;
}

export class SharedInventoryDto {
  @ApiProperty()
  shareId: string;

  @ApiProperty()
  ownerUserId: string;

  @ApiProperty()
  ownerEmail: string;

  @ApiProperty()
  ownerFirstName: string;

  @ApiProperty()
  ownerLastName: string;

  @ApiProperty({ enum: SharePermission })
  permission: SharePermission;

  @ApiProperty({ type: String, format: 'date-time' })
  sharedAt: Date;
}

export class InviteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sharedWithEmail: string;

  @ApiProperty({ enum: SharePermission })
  permission: SharePermission;

  @ApiProperty({ enum: ShareStatus })
  status: ShareStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;
}
