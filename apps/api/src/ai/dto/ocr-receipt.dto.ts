import { IsBase64, IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class OcrReceiptDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  imageUrl?: string;

  @ValidateIf((o: OcrReceiptDto) => !o.imageUrl)
  @IsBase64()
  imageBase64?: string;

  @ValidateIf((o: OcrReceiptDto) => Boolean(o.imageBase64))
  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/webp'])
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}
