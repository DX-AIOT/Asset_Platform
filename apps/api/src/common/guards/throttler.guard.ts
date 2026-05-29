import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger('RateLimit');

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const retryAfter = Math.ceil(throttlerLimitDetail.timeToExpire);
    response.setHeader('Retry-After', retryAfter);

    const ip =
      request.ip ||
      (request.connection as { remoteAddress?: string })?.remoteAddress ||
      'unknown';
    this.logger.warn(
      `Rate limit exceeded — ip=${ip} path=${request.url} ` +
        `hits=${throttlerLimitDetail.totalHits}/${throttlerLimitDetail.limit} ` +
        `retryAfter=${retryAfter}s`,
    );

    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
