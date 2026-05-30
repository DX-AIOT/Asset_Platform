import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RecognizeAssetDto {
  @ApiProperty({
    description: 'Base64-encoded image of the asset (JPEG, PNG, or WebP). Minimum 32 characters.',
    minLength: 32,
  })
  @IsString()
  @MinLength(32)
  imageBase64!: string;
}
