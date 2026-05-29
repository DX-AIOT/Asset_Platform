import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/insurance?format=pdf&categoryIds=electronics,vehicles
   * Streams an insurance PDF report for the authenticated user's assets.
   */
  @Get('insurance')
  async getInsuranceReport(
    @CurrentUser() user: any,
    @Query('format') format: string = 'pdf',
    @Query('categoryIds') categoryIds?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const cats = categoryIds
      ? categoryIds.split(',').map((c) => c.trim()).filter(Boolean)
      : undefined;

    const pdfBuffer = await this.reportsService.generateInsurancePdf(user.id, cats);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="insurance-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
