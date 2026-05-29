import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ItemCategory } from './entities/item.entity';
import { ItemResponseDto, ItemsListResponseDto, PortfolioValueResponseDto, UpdateItemDto } from './dto';

@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get('my')
  async getMyItems(
    @CurrentUser() user: any,
    @Query('category') category?: ItemCategory,
    @Query('location') location?: string
  ): Promise<ItemsListResponseDto> {
    return this.itemsService.findMyItems(user.id, category, location);
  }

  @Get('my/value')
  async getMyPortfolioValue(@CurrentUser() user: any): Promise<PortfolioValueResponseDto> {
    return this.itemsService.calculatePortfolioValue(user.id);
  }

  @Get(':id')
  async getItem(@CurrentUser() user: any, @Param('id') id: string): Promise<ItemResponseDto> {
    return this.itemsService.findOne(id, user.id);
  }

  @Patch(':id')
  async updateItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto
  ): Promise<ItemResponseDto> {
    return this.itemsService.update(id, user.id, dto);
  }

  @Get(':id/price-history')
  async getPriceHistory(@CurrentUser() user: any, @Param('id') id: string) {
    return this.itemsService.getPriceHistory(id, user.id);
  }
}
