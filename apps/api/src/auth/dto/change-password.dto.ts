import { IsString, MinLength, MaxLength } from 'class-validator';
import { IsNotCommonPassword } from '../validators/is-not-common-password.validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(64, { message: 'Password must not exceed 64 characters' })
  @IsNotCommonPassword()
  newPassword: string;
}
