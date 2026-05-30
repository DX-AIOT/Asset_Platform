import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class BarcodeLookupRequestDto {
  @ApiProperty({ example: '0194252064992', description: 'EAN-13, UPC-A, or QR barcode value.' })
  @IsString()
  barcode!: string;
}

export class BarcodeLookupProductDto {
  @ApiProperty({ example: '0194252064992' })
  barcode!: string;

  @ApiProperty({ example: 'MacBook Pro 14-inch' })
  name!: string;

  @ApiProperty({ example: 'Apple' })
  brand!: string;

  @ApiProperty({ example: 'laptops' })
  category!: string;
}

export class BarcodeLookupResponseDto {
  @ApiProperty({ description: 'True when the barcode matched a known product.' })
  found!: boolean;

  @ApiProperty({ example: '0194252064992' })
  barcode!: string;

  @ApiPropertyOptional({ type: BarcodeLookupProductDto, nullable: true })
  product!: BarcodeLookupProductDto | null;

  @ApiProperty({ description: 'True when the result is a best-guess fallback, not a confirmed match.' })
  fallbackOnly!: boolean;
}
