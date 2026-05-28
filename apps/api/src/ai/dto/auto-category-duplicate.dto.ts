import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssetFingerprintDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryHint?: string;
}

export class InventoryAssetDto extends AssetFingerprintDto {
  @IsString()
  @MaxLength(80)
  id!: string;
}

export class AutoCategoryDuplicateDto {
  @ValidateNested()
  @Type(() => AssetFingerprintDto)
  candidate!: AssetFingerprintDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryAssetDto)
  inventory!: InventoryAssetDto[];
}
