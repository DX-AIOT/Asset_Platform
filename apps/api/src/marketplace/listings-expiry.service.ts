import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ListingsService } from './listings.service';

@Injectable()
export class ListingsExpiryService {
  private readonly logger = new Logger(ListingsExpiryService.name);

  constructor(private readonly listingsService: ListingsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireListings(): Promise<void> {
    const count = await this.listingsService.markExpiredListings();
    if (count > 0) {
      this.logger.log(`Expired ${count} marketplace listing(s)`);
    }
  }
}
