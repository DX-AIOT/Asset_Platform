import { Body, Controller, Post } from '@nestjs/common';
import { OcrReceiptDto } from './dto/ocr-receipt.dto';
import { OcrReceiptService, ReceiptOcrResult } from './ocr-receipt.service';

@Controller('ai')
export class OcrReceiptController {
  constructor(private readonly ocrReceiptService: OcrReceiptService) {}

  @Post('ocr-receipt')
  async ocrReceipt(@Body() payload: OcrReceiptDto): Promise<ReceiptOcrResult> {
    return this.ocrReceiptService.extract(payload);
  }
}
