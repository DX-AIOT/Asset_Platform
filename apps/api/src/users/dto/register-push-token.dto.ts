import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({
    description: 'Expo push token obtained from the mobile app (e.g. ExponentPushToken[xxxx]).',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$/, {
    message: 'pushToken must be a valid Expo push token',
  })
  pushToken!: string;
}
