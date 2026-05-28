import { Module } from '@nestjs/common';
import { OcrReceiptController } from './ocr-receipt.controller';
import { OcrReceiptService } from './ocr-receipt.service';

@Module({
  controllers: [OcrReceiptController],
  providers: [OcrReceiptService],
})
export class AiModule {}
