import { ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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

    throw new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too Many Requests', retryAfter },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
