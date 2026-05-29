import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { SharePermission } from '../entities/family-share.entity';

export class InviteDto {
  @IsEmail()
  email: string;

  @IsEnum(SharePermission)
  @IsOptional()
  permission?: SharePermission = SharePermission.VIEW;
}
