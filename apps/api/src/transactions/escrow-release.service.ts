import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionsService } from './transactions.service';

@Injectable()
export class EscrowReleaseService {
  private readonly logger = new Logger(EscrowReleaseService.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async releaseExpiredEscrows() {
    this.logger.log('Running escrow auto-release check');
    await this.transactionsService.releaseExpiredEscrows();
  }
}
