import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBase64, IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class OcrReceiptDto {
  @ApiPropertyOptional({
    description: 'Publicly accessible URL to the receipt image. Mutually exclusive with imageBase64.',
    example: 'https://example.com/receipt.jpg',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Base64-encoded receipt image. Required when imageUrl is not provided.',
  })
  @ValidateIf((o: OcrReceiptDto) => !o.imageUrl)
  @IsBase64()
  imageBase64?: string;

  @ApiPropertyOptional({
    description: 'MIME type of the base64 image. Required when imageBase64 is provided.',
    enum: ['image/png', 'image/jpeg', 'image/webp'],
  })
  @ValidateIf((o: OcrReceiptDto) => Boolean(o.imageBase64))
  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/webp'])
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}
