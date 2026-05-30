import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PriceHistoryService } from './price-history.service';

/**
 * Nightly scheduler that re-values stale item valuations (DXS-181). Thin wrapper
 * over {@link PriceHistoryService.refreshStaleValuations} so the batch logic
 * stays unit-testable without the scheduler. Runs at 02:00 daily.
 */
@Injectable()
export class ValuationRefreshService {
  private readonly logger = new Logger(ValuationRefreshService.name);

  constructor(private readonly priceHistoryService: PriceHistoryService) {}

  @Cron('0 2 * * *')
  async refreshValuations(): Promise<void> {
    try {
      await this.priceHistoryService.refreshStaleValuations();
    } catch (err) {
      this.logger.error(
        `Nightly valuation refresh failed: ${(err as Error).message}`,
      );
    }
  }
}
