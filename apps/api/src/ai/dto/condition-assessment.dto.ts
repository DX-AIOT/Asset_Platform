import {
  IsBase64,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

/**
 * Input for POST /ai/condition-assessment.
 * Provide a photo either as `photoUrl` or as `imageBase64`.
 * `itemId` is optional: when present and the item exists, the assessed
 * condition is persisted onto that item.
 */
export class ConditionAssessmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  itemId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  photoUrl?: string;

  @ValidateIf((o: ConditionAssessmentDto) => !o.photoUrl)
  @IsBase64()
  imageBase64?: string;

  @ValidateIf((o: ConditionAssessmentDto) => Boolean(o.imageBase64))
  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/webp'])
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}
