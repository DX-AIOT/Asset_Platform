import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('insurance')
  @ApiOperation({
    summary: 'Download an insurance asset report as PDF',
    description:
      'Generates a multi-page A4 PDF containing a cover page, one detail page per asset, ' +
      'and a summary table. Optionally filtered to specific categories.',
  })
  @ApiProduces('application/pdf')
  @ApiQuery({ name: 'format', enum: ['pdf'], required: false, description: 'Output format (only pdf is supported)' })
  @ApiQuery({
    name: 'categoryIds',
    type: String,
    required: false,
    description: 'Comma-separated category IDs to include (omit for all categories)',
    example: 'electronics,vehicles',
  })
  @ApiResponse({ status: 200, description: 'PDF binary stream.', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
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
