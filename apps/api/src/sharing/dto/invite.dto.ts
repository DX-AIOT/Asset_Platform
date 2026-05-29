import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { SharePermission } from '../entities/family-share.entity';

export class InviteDto {
  @ApiProperty({ example: 'partner@example.com', description: 'Email address of the person to invite.' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: SharePermission, default: SharePermission.VIEW })
  @IsEnum(SharePermission)
  @IsOptional()
  permission?: SharePermission = SharePermission.VIEW;
}
