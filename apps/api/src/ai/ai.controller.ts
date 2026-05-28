import { Body, Controller, Post } from '@nestjs/common';
import { RecognizeAssetDto } from './dto/recognize-asset.dto';
import { VisionRecognitionService } from './vision-recognition.service';
import { AssetRecognitionResult } from '@dx-aiot/shared';

@Controller('ai')
export class AiController {
  constructor(private readonly visionRecognitionService: VisionRecognitionService) {}

  @Post('recognize')
  async recognize(@Body() dto: RecognizeAssetDto): Promise<AssetRecognitionResult> {
    return this.visionRecognitionService.recognizeFromBase64(dto.imageBase64);
  }
}
