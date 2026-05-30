import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerLimitDetail } from '@nestjs/throttler';
import { CustomThrottlerGuard } from '../src/common/guards/throttler.guard';

const makeLimitDetail = (overrides: Partial<ThrottlerLimitDetail> = {}): ThrottlerLimitDetail => ({
  limit: 10,
  ttl: 60000,
  key: 'test-key',
  tracker: '127.0.0.1',
  totalHits: 11,
  timeToExpire: 45,
  isBlocked: true,
  timeToBlockExpire: 45,
  ...overrides,
});

const makeContext = (url = '/api/auth/login', ip = '127.0.0.1') => {
  const setHeader = jest.fn();
  const mockReq = { url, ip };
  const mockRes = { setHeader };
  return {
    context: { setHeader, mockReq, mockRes },
    switchToHttp: () => ({
      getRequest: () => mockReq,
      getResponse: () => mockRes,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext & { context: { setHeader: jest.Mock } };
};

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    guard = new CustomThrottlerGuard(
      { throttlers: [] },
      { isSet: false } as any,
      {} as any,
    );
  });

  it('sets Retry-After header before throwing', async () => {
    const ctx = makeContext();
    const res = ctx.switchToHttp().getResponse() as { setHeader: jest.Mock };
    const detail = makeLimitDetail({ timeToExpire: 30 });

    await expect(
      (guard as any).throwThrottlingException(ctx, detail),
    ).rejects.toBeInstanceOf(HttpException);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 30);
  });

  it('throws HttpException with the required 429 response shape', async () => {
    const ctx = makeContext();
    const detail = makeLimitDetail({ timeToExpire: 25.7 });

    let thrown: HttpException | undefined;
    try {
      await (guard as any).throwThrottlingException(ctx, detail);
    } catch (e) {
      thrown = e as HttpException;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect(thrown!.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

    const body = thrown!.getResponse() as { statusCode: number; message: string; retryAfter: number };
    expect(body.statusCode).toBe(429);
    expect(body.message).toBe('Too Many Requests');
    expect(body.retryAfter).toBe(26);
  });

  it('rounds fractional timeToExpire up', async () => {
    const ctx = makeContext();
    const detail = makeLimitDetail({ timeToExpire: 1.1 });

    let thrown: HttpException | undefined;
    try {
      await (guard as any).throwThrottlingException(ctx, detail);
    } catch (e) {
      thrown = e as HttpException;
    }

    const body = thrown!.getResponse() as { retryAfter: number };
    expect(body.retryAfter).toBe(2);

    const res = ctx.switchToHttp().getResponse() as { setHeader: jest.Mock };
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 2);
  });
});
