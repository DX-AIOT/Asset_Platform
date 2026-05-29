import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OcrReceiptDto } from './dto/ocr-receipt.dto';
import { OcrReceiptService, ReceiptOcrResult } from './ocr-receipt.service';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai')
export class OcrReceiptController {
  constructor(private readonly ocrReceiptService: OcrReceiptService) {}

  @Post('ocr-receipt')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Extract purchase data from a receipt image',
    description:
      'Accepts either a public image URL or a base64-encoded image (with mimeType). ' +
      'Returns the store name, date, line items, and total from the receipt. ' +
      'Uses OpenAI Vision; stubs data in local mode.',
  })
  @ApiResponse({ status: 201, description: 'Extracted receipt data.' })
  @ApiResponse({ status: 400, description: 'Invalid image payload.' })
  async ocrReceipt(@Body() payload: OcrReceiptDto): Promise<ReceiptOcrResult> {
    return this.ocrReceiptService.extract(payload);
  }
}
