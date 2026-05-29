import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ItemCategory } from './entities/item.entity';
import {
  DepreciationResponseDto,
  ItemResponseDto,
  ItemsListResponseDto,
  PortfolioValueResponseDto,
} from './dto';

@ApiTags('items')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get('my')
  @ApiOperation({
    summary: 'List the authenticated user\'s assets',
    description: 'Returns all assets owned by the caller, with optional category and location filters.',
  })
  @ApiQuery({ name: 'category', enum: ItemCategory, required: false })
  @ApiQuery({ name: 'location', type: String, required: false, description: 'Partial location match (case-insensitive)' })
  @ApiResponse({ status: 200, description: 'Asset list with total count.', type: ItemsListResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async getMyItems(
    @CurrentUser() user: any,
    @Query('category') category?: ItemCategory,
    @Query('location') location?: string,
  ): Promise<ItemsListResponseDto> {
    return this.itemsService.findMyItems(user.id, category, location);
  }

  @Get('my/value')
  @ApiOperation({
    summary: 'Get total and depreciated portfolio value',
    description: 'Sums purchase prices and current depreciated values across all assets.',
  })
  @ApiResponse({ status: 200, description: 'Portfolio totals.', type: PortfolioValueResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async getMyPortfolioValue(
    @CurrentUser() user: any,
  ): Promise<PortfolioValueResponseDto> {
    return this.itemsService.calculatePortfolioValue(user.id);
  }

  @Get(':id/depreciation')
  @ApiOperation({
    summary: 'Get year-by-year depreciation for an asset',
    description:
      'Uses the item\'s custom depreciation rate if set, otherwise falls back to category defaults. ' +
      'Returns null currentValue/percentLost when purchase data is missing.',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Depreciation schedule.', type: DepreciationResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Asset not found or not owned by caller.' })
  async getItemDepreciation(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<DepreciationResponseDto> {
    return this.itemsService.getDepreciation(id, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single asset by ID' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Asset detail.', type: ItemResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Asset not found or not owned by caller.' })
  async getItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ItemResponseDto> {
    return this.itemsService.findOne(id, user.id);
  }
}
