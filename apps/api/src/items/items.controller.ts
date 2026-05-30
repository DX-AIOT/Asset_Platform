import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBody,
  ApiConsumes,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { PriceHistoryService } from '../ai/price-history.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ItemCategory } from './entities/item.entity';
import {
  CreateItemDto,
  UpdateItemDto,
  DepreciationResponseDto,
  ItemResponseDto,
  ItemsListResponseDto,
  PortfolioValueResponseDto,
  PriceHistoryResponseDto,
} from './dto';
import * as crypto from 'crypto';
import * as path from 'path';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags('items')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly priceHistoryService: PriceHistoryService,
    private readonly storageService: StorageService,
  ) {}

  @Post('photos/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Upload a photo and get back a storable URL',
    description:
      'Accepts a single image file (JPEG, PNG, WebP, GIF; max 10 MB). ' +
      'In local mode the file is saved to disk; in production it is uploaded to S3 via CloudFront. ' +
      'Include the returned URL in the `photos` array when creating or updating an asset.',
  })
  @ApiResponse({ status: 201, description: 'Upload successful.', schema: { example: { url: 'https://cdn.example.com/items/uuid.jpg' } } })
  @ApiResponse({ status: 400, description: 'No file provided or unsupported type.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async uploadPhoto(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const key = `items/${user.id}/${crypto.randomUUID()}${ext}`;
    const url = await this.storageService.uploadFile(file.buffer, key, file.mimetype);
    return { url };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new asset',
    description: 'Creates an asset owned by the authenticated user. The photos array is persisted in the submitted order.',
  })
  @ApiResponse({ status: 201, description: 'Asset created.', type: ItemResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async createItem(
    @CurrentUser() user: any,
    @Body() dto: CreateItemDto,
  ): Promise<ItemResponseDto> {
    return this.itemsService.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Partially update an asset',
    description: 'Updates only the supplied fields. If photos is provided, condition is re-assessed asynchronously.',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Updated asset.', type: ItemResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Asset not found or not owned by caller.' })
  async updateItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ): Promise<ItemResponseDto> {
    return this.itemsService.update(id, user.id, dto);
  }

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
    @Query('location') location?: string
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

  @Get(':id/price-history')
  @ApiOperation({
    summary: 'Get the value time-series and market trend for an asset',
    description:
      'Returns price-history snapshots (recorded on creation, condition change, ' +
      'or on-demand) ordered oldest→newest, plus the directional trend (up/flat/down) ' +
      'and % change over the 30/90/365-day trailing windows.',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Price-history time-series and trend.', type: PriceHistoryResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Asset not found or not owned by caller.' })
  async getItemPriceHistory(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<PriceHistoryResponseDto> {
    return this.priceHistoryService.getHistory(id, user.id);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="items.csv"')
  @ApiOperation({
    summary: 'Export all assets as CSV',
    description: 'Downloads all assets owned by the authenticated user as a UTF-8 CSV file.',
  })
  @ApiResponse({ status: 200, description: 'CSV file download.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async exportItems(@CurrentUser() user: any): Promise<StreamableFile> {
    const csv = await this.itemsService.exportCsv(user.id);
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an asset by ID' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 204, description: 'Asset deleted.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 404, description: 'Asset not found or not owned by caller.' })
  async deleteItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<void> {
    return this.itemsService.remove(id, user.id);
  }
}
