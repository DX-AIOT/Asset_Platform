import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'Firebase Cloud Messaging (FCM) device token for push notification delivery.' })
  @IsString()
  fcmToken!: string;
}
