import { Body, Controller, Post } from '@nestjs/common';
import { AutoCategoryDuplicateDto } from './dto/auto-category-duplicate.dto';
import {
  AutoCategoryDuplicateResult,
  AutoCategoryDuplicateService,
} from './auto-category-duplicate.service';

@Controller('ai')
export class AssetIntelligenceController {
  constructor(private readonly autoCategoryDuplicateService: AutoCategoryDuplicateService) {}

  @Post('auto-category-duplicate')
  classifyAndDetect(@Body() dto: AutoCategoryDuplicateDto): AutoCategoryDuplicateResult {
    return this.autoCategoryDuplicateService.evaluate(dto.candidate, dto.inventory);
  }
}
