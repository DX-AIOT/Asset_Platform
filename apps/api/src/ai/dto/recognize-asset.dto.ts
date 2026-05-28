import { IsString, MinLength } from 'class-validator';

export class RecognizeAssetDto {
  @IsString()
  @MinLength(32)
  imageBase64!: string;
}
