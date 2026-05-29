import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { RecognizeAssetDto } from './dto/recognize-asset.dto';
import { VisionRecognitionService } from './vision-recognition.service';
import { AssetRecognitionResult, ValuationResult } from '@dx-aiot/shared';
import {
  BarcodeLookupRequestDto,
  BarcodeLookupResponseDto,
} from './dto/barcode-lookup.dto';
import { BarcodeLookupService } from './barcode-lookup.service';
import { ValuationRequestDto } from './dto/valuation.dto';
import { MarketValuationService } from './market-valuation.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly visionRecognitionService: VisionRecognitionService,
    private readonly barcodeLookupService: BarcodeLookupService,
    private readonly marketValuationService: MarketValuationService,
  ) {}

  @Post('recognize')
  async recognize(@Body() dto: RecognizeAssetDto): Promise<AssetRecognitionResult> {
    return this.visionRecognitionService.recognizeFromBase64(dto.imageBase64);
  }

  @Post('barcode-lookup')
  lookupBarcode(@Body() dto: BarcodeLookupRequestDto): BarcodeLookupResponseDto {
    if (!dto?.barcode || dto.barcode.trim().length === 0) {
      throw new BadRequestException('barcode is required');
    }

    return this.barcodeLookupService.lookupByBarcode(dto.barcode);
  }

  @Post('valuation')
  async valuation(@Body() dto: ValuationRequestDto): Promise<ValuationResult> {
    const referenceYear = new Date().getFullYear();
    return this.marketValuationService.estimate(dto, referenceYear);
  }
}
