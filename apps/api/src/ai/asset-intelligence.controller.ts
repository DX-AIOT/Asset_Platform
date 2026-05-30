import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AutoCategoryDuplicateDto } from './dto/auto-category-duplicate.dto';
import {
  AutoCategoryDuplicateResult,
  AutoCategoryDuplicateService,
} from './auto-category-duplicate.service';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai')
export class AssetIntelligenceController {
  constructor(private readonly autoCategoryDuplicateService: AutoCategoryDuplicateService) {}

  @Post('auto-category-duplicate')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Classify a candidate asset and detect duplicates',
    description:
      'Returns the most likely category for the candidate and a list of probable ' +
      'duplicates from the provided inventory using fuzzy name matching.',
  })
  @ApiResponse({ status: 201, description: 'Classification and duplicate detection result.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  classifyAndDetect(@Body() dto: AutoCategoryDuplicateDto): AutoCategoryDuplicateResult {
    return this.autoCategoryDuplicateService.evaluate(dto.candidate, dto.inventory);
  }
}
