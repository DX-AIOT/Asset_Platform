import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RecognizeAssetDto } from './dto/recognize-asset.dto';
import { VisionRecognitionService } from './vision-recognition.service';
import {
  AssetRecognitionResult,
  ConditionAssessmentResult,
  ListingAutofillDraft,
  ListingPriceSuggestion,
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
import { ListingPriceSuggestDto } from './dto/listing-price-suggest.dto';
import { ListingSuggestionService } from './listing-suggestion.service';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai')
export class AiController {
  constructor(
    private readonly visionRecognitionService: VisionRecognitionService,
    private readonly barcodeLookupService: BarcodeLookupService,
    private readonly marketValuationService: MarketValuationService,
    private readonly conditionAssessmentService: ConditionAssessmentService,
    private readonly listingSuggestionService: ListingSuggestionService,
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
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
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
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
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
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
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

  @Post('listing-price-suggest')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Suggest a listing price for an asset',
    description:
      'Values the asset with the market valuation engine (DXS-62) and applies a ' +
      'confidence-scaled seller premium. Returns a suggested price, market value, ' +
      'and negotiation range in VND. Results are cached in Redis for 24h keyed by itemId+condition.',
  })
  @ApiResponse({ status: 201, description: 'Suggested listing price with range, confidence, and rationale.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  async listingPriceSuggest(@Body() dto: ListingPriceSuggestDto): Promise<ListingPriceSuggestion> {
    const referenceYear = new Date().getFullYear();
    return this.listingSuggestionService.suggestPrice(dto, referenceYear);
  }

  @Get('listing-autofill/:itemId')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Pre-fill a listing draft from asset data',
    description:
      'Returns a non-persisted listing draft (title, category, condition, description, photos, ' +
      'location) built from the stored asset. The description is a brief, factual skeleton — ' +
      'no invented specifications. The frontend uses it to pre-fill the create-listing form.',
  })
  @ApiParam({ name: 'itemId', format: 'uuid', description: 'ID of the asset to draft a listing for.' })
  @ApiResponse({ status: 200, description: 'Pre-populated listing draft.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  async listingAutofill(@Param('itemId') itemId: string): Promise<ListingAutofillDraft> {
    return this.listingSuggestionService.autofill(itemId);
  }
}
