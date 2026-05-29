import { IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  fcmToken!: string;
}
