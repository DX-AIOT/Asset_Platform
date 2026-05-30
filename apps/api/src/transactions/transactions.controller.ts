import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TransactionsService } from './transactions.service';
import { TransactionStatus } from './entities/transaction.entity';
import { IpnPayload } from '../payments/interfaces/payment-gateway.interface';

class InitiateTransactionDto {
  listingId!: string;
}

class RaiseDisputeDto {
  reason!: string;
}

class ResolveDisputeDto {
  resolution!: 'BUYER_REFUNDED' | 'SELLER_RELEASED';
}

@ApiTags('transactions')
@Controller()
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate purchase — creates transaction and returns MoMo payment URL' })
  initiate(@Body() dto: InitiateTransactionDto, @CurrentUser() user: { id: string }) {
    return this.service.initiate(dto.listingId, user.id);
  }

  @Get('transactions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction state' })
  getTransaction(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.getTransaction(id, user.id);
  }

  @Post('transactions/:id/confirm-receipt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer confirms receipt — triggers MoMo escrow release to seller' })
  confirmReceipt(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.confirmReceipt(id, user.id);
  }

  @Post('transactions/:id/dispute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer raises dispute — escrow release paused' })
  raiseDispute(
    @Param('id') id: string,
    @Body() dto: RaiseDisputeDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.raiseDispute(id, user.id, dto.reason);
  }

  @Post('admin/transactions/:id/resolve-dispute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Resolve dispute — refund buyer or release escrow to seller' })
  resolveDispute(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.service.resolveDispute(id, dto.resolution);
  }

  @Get('admin/transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] List transactions by status — use ?status=release_failed for stuck releases' })
  adminListTransactions(@Query('status') status?: TransactionStatus) {
    return this.service.listAdminTransactions(status);
  }

  @Post('admin/transactions/:id/retry-release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Manually retry escrow release for a RELEASE_FAILED transaction' })
  adminRetryRelease(@Param('id') id: string) {
    return this.service.adminRetryRelease(id);
  }

  @Post('webhooks/momo/ipn')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MoMo IPN webhook — HMAC-verified, no JWT' })
  async momoIpn(@Body() payload: IpnPayload) {
    await this.service.handleIpn(payload);
    return { message: 'ok' };
  }
}
