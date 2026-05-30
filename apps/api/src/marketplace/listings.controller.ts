import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { BrowseListingsQueryDto, MyListingsQueryDto } from './dto/browse-listings-query.dto';
import {
  ListingResponseDto,
  ListingsPageDto,
  MyListingsPageDto,
} from './dto/listing-response.dto';

@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@Controller('marketplace')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  // ── Browse (public-ish, still requires auth) ──────────────────────────────

  @Get('listings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Browse active listings with filters' })
  @ApiResponse({ status: 200, description: 'Paginated active listings.', type: ListingsPageDto })
  async browse(@Query() query: BrowseListingsQueryDto): Promise<ListingsPageDto> {
    return this.listingsService.browse(query);
  }

  // my-listings MUST be before :id to avoid route conflict
  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "All of the caller's listings (all statuses)" })
  @ApiResponse({ status: 200, type: MyListingsPageDto })
  async myListings(
    @CurrentUser() user: any,
    @Query() query: MyListingsQueryDto,
  ): Promise<MyListingsPageDto> {
    return this.listingsService.findMyListings(user.id, query);
  }

  @Get('listings/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get listing detail with seller profile' })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  @ApiResponse({ status: 200, type: ListingResponseDto })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findOne(@Param('id') id: string): Promise<ListingResponseDto> {
    return this.listingsService.findDetail(id);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  @Post('listings')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a listing from an owned item (status: draft)' })
  @ApiResponse({ status: 201, type: ListingResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Item not owned by caller.' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateListingDto,
  ): Promise<ListingResponseDto> {
    return this.listingsService.create(dto, user.id);
  }

  @Patch('listings/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Edit a draft or inactive listing' })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  @ApiResponse({ status: 200, type: ListingResponseDto })
  @ApiResponse({ status: 400, description: 'Listing not editable in its current status.' })
  @ApiResponse({ status: 403, description: 'Not the seller.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<ListingResponseDto> {
    return this.listingsService.update(id, user.id, dto);
  }

  @Post('listings/:id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Publish a listing (status → active, schedules 30-day expiry)' })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  @ApiResponse({ status: 200, type: ListingResponseDto })
  @ApiResponse({ status: 403, description: 'Not the seller.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async publish(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ListingResponseDto> {
    return this.listingsService.publish(id, user.id);
  }

  @Post('listings/:id/unpublish')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unpublish a listing (status → inactive)' })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  @ApiResponse({ status: 200, type: ListingResponseDto })
  @ApiResponse({ status: 403, description: 'Not the seller.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async unpublish(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ListingResponseDto> {
    return this.listingsService.unpublish(id, user.id);
  }

  @Delete('listings/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a listing (status → deleted, hidden from all queries)' })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 403, description: 'Not the seller.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<void> {
    return this.listingsService.remove(id, user.id);
  }
}
