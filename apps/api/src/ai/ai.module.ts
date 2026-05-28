import { Module } from '@nestjs/common';
import { OcrReceiptController } from './ocr-receipt.controller';
import { OcrReceiptService } from './ocr-receipt.service';
import { AiController } from './ai.controller';
import { VisionRecognitionService } from './vision-recognition.service';
import { AssetIntelligenceController } from './asset-intelligence.controller';
import { AutoCategoryDuplicateService } from './auto-category-duplicate.service';

@Module({
  controllers: [AiController, OcrReceiptController, AssetIntelligenceController],
  providers: [VisionRecognitionService, OcrReceiptService, AutoCategoryDuplicateService],
})
export class AiModule {}
