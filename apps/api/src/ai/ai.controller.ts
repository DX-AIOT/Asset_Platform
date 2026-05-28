import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { RecognizeAssetDto } from './dto/recognize-asset.dto';
import { VisionRecognitionService } from './vision-recognition.service';
import { AssetRecognitionResult } from '../shared/vision';
import { BarcodeLookupRequestDto, BarcodeLookupResponseDto } from './dto/barcode-lookup.dto';
import { BarcodeLookupService } from './barcode-lookup.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly visionRecognitionService: VisionRecognitionService,
    private readonly barcodeLookupService: BarcodeLookupService
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
}
