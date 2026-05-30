import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TransactionsService } from './transactions.service';

@Injectable()
export class EscrowReleaseService {
  private readonly logger = new Logger(EscrowReleaseService.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  // Every 15 minutes: auto-release expired escrows with no open dispute
  @Cron('0/15 * * * *')
  async releaseExpiredEscrows() {
    this.logger.log('Running escrow auto-release check');
    await this.transactionsService.releaseExpiredEscrows();
  }

  // Every minute: process scheduled retries for previously-failed releases
  @Cron('* * * * *')
  async processReleaseRetries() {
    await this.transactionsService.processScheduledReleaseRetries();
  }
}
