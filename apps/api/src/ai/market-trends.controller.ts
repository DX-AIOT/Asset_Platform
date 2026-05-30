import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CategoryTrendsResponse } from '@dx-aiot/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketTrendsService } from './market-trends.service';

@ApiTags('market')
@ApiBearerAuth('access-token')
@Controller('market')
export class MarketTrendsController {
  constructor(private readonly marketTrendsService: MarketTrendsService) {}

  @Get('category-trends')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Category-level price trends for the marketplace browse page',
    description:
      'Aggregates the trailing 30 days of price history by category, returning ' +
      'average value, trend direction, percent change and sample size per ' +
      'category. Cached in-process for 6h.',
  })
  @ApiResponse({ status: 200, description: 'Aggregated category trends.' })
  getCategoryTrends(): Promise<CategoryTrendsResponse> {
    return this.marketTrendsService.getCategoryTrends();
  }
}
