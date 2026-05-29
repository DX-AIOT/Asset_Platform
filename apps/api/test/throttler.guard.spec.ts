import { ExecutionContext } from '@nestjs/common';
import { ThrottlerException, ThrottlerLimitDetail } from '@nestjs/throttler';
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
    switchToHttp: () => ({
      getRequest: () => mockReq,
      getResponse: () => mockRes,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    guard = new CustomThrottlerGuard(
      { throttlers: [] },
      { isSet: false } as any,
      {} as any,
    );
    // Stub the parent so we don't need the full DI chain
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'throwThrottlingException')
      .mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('sets Retry-After header before throwing', async () => {
    const ctx = makeContext();
    const res = ctx.switchToHttp().getResponse() as { setHeader: jest.Mock };
    const detail = makeLimitDetail({ timeToExpire: 30 });

    await expect(
      (guard as any).throwThrottlingException(ctx, detail),
    ).resolves.toBeUndefined();

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 30);
  });

  it('calls parent throwThrottlingException', async () => {
    const ctx = makeContext();
    const detail = makeLimitDetail();
    const parentSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'throwThrottlingException')
      .mockResolvedValue(undefined);

    await (guard as any).throwThrottlingException(ctx, detail);

    expect(parentSpy).toHaveBeenCalledWith(ctx, detail);
  });
});
