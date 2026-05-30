import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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
import { IpnPayload } from '../payments/interfaces/payment-gateway.interface';

class InitiateTransactionDto {
  listingId!: string;
}

class RaiseDisputeDto {
  reason!: string;
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
  @ApiOperation({ summary: 'Buyer confirms receipt — escrow released to seller' })
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

  @Post('transactions/:id/resolve-dispute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: '[Admin] Resolve dispute — pending admin UI (Sprint 5 stub)' })
  resolveDispute() {
    return { message: 'Dispute resolution UI pending — manual resolution required' };
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
