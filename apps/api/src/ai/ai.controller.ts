import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RecognizeAssetDto } from './dto/recognize-asset.dto';
import { VisionRecognitionService } from './vision-recognition.service';
import {
  AssetRecognitionResult,
  ConditionAssessmentResult,
  ValuationResult,
} from '@dx-aiot/shared';
import {
  BarcodeLookupRequestDto,
  BarcodeLookupResponseDto,
} from './dto/barcode-lookup.dto';
import { BarcodeLookupService } from './barcode-lookup.service';
import { ValuationRequestDto } from './dto/valuation.dto';
import { MarketValuationService } from './market-valuation.service';
import { ConditionAssessmentDto } from './dto/condition-assessment.dto';
import { ConditionAssessmentService } from './condition-assessment.service';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai')
export class AiController {
  constructor(
    private readonly visionRecognitionService: VisionRecognitionService,
    private readonly barcodeLookupService: BarcodeLookupService,
    private readonly marketValuationService: MarketValuationService,
    private readonly conditionAssessmentService: ConditionAssessmentService,
  ) {}

  @Post('recognize')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Identify an asset from a base64-encoded image',
    description:
      'Sends the image to OpenAI Vision. In local mode (`OPENAI_LOCAL_MODE=true`) ' +
      'returns a deterministic stub without consuming API credits.',
  })
  @ApiResponse({ status: 201, description: 'Recognition result with category, brand, and model suggestions.' })
  @ApiResponse({ status: 400, description: 'Invalid or missing imageBase64.' })
  async recognize(@Body() dto: RecognizeAssetDto): Promise<AssetRecognitionResult> {
    return this.visionRecognitionService.recognizeFromBase64(dto.imageBase64);
  }

  @Post('barcode-lookup')
  @ApiOperation({
    summary: 'Look up product data from a barcode',
    description: 'Returns product name, brand, and category from the built-in barcode catalogue. Falls back to a generic result when no match is found.',
  })
  @ApiResponse({ status: 201, description: 'Lookup result (found=true) or fallback (found=false).' })
  @ApiResponse({ status: 400, description: 'Barcode value is missing or empty.' })
  lookupBarcode(@Body() dto: BarcodeLookupRequestDto): BarcodeLookupResponseDto {
    if (!dto?.barcode || dto.barcode.trim().length === 0) {
      throw new BadRequestException('barcode is required');
    }

    return this.barcodeLookupService.lookupByBarcode(dto.barcode);
  }

  @Post('valuation')
  @ApiOperation({
    summary: 'Estimate current market value for an asset',
    description:
      'Applies a rule-based depreciation model using category, condition, purchase year, and ' +
      'purchase price. Results are cached in Redis for 24 hours to avoid redundant computation.',
  })
  @ApiResponse({ status: 201, description: 'Valuation result with estimated value and confidence range.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  async valuation(@Body() dto: ValuationRequestDto): Promise<ValuationResult> {
    const referenceYear = new Date().getFullYear();
    return this.marketValuationService.estimate(dto, referenceYear);
  }

  @Post('condition-assessment')
  @ApiOperation({
    summary: 'Assess asset condition from an image',
    description: 'Uses OpenAI Vision to score the physical condition of the asset on a new→poor scale.',
  })
  @ApiResponse({ status: 201, description: 'Condition assessment result.' })
  @ApiResponse({ status: 400, description: 'Invalid image input.' })
  async conditionAssessment(
    @Body() dto: ConditionAssessmentDto,
  ): Promise<ConditionAssessmentResult> {
    return this.conditionAssessmentService.assess(dto);
  }
}
