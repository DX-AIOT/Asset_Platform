import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from '../src/auth/guards/csrf.guard';
import { IS_PUBLIC_KEY } from '../src/auth/decorators/public.decorator';
import { SKIP_CSRF_KEY } from '../src/auth/decorators/skip-csrf.decorator';

function makeContext(opts: {
  method?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): ExecutionContext {
  const { method = 'POST', cookies = {}, headers = {} } = opts;
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, cookies, headers }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new CsrfGuard(reflector);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('safe HTTP methods — bypass guard', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('%s passes without token', (method) => {
      expect(guard.canActivate(makeContext({ method }))).toBe(true);
    });
  });

  describe('@Public() routes — bypass guard (login/register have no token yet)', () => {
    it('allows @Public() POST without CSRF token', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === IS_PUBLIC_KEY ? true : undefined,
      );
      expect(guard.canActivate(makeContext({ method: 'POST' }))).toBe(true);
    });
  });

  describe('@SkipCsrf() routes — explicit bypass', () => {
    it('allows @SkipCsrf() POST without CSRF token', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SKIP_CSRF_KEY ? true : undefined,
      );
      expect(guard.canActivate(makeContext({ method: 'POST' }))).toBe(true);
    });
  });

  describe('missing tokens — should reject', () => {
    it('throws ForbiddenException when csrf-token cookie is absent', () => {
      expect(() =>
        guard.canActivate(
          makeContext({ method: 'POST', headers: { 'x-csrf-token': 'abc' } }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when X-CSRF-Token header is absent', () => {
      expect(() =>
        guard.canActivate(
          makeContext({ method: 'POST', cookies: { 'csrf-token': 'abc' } }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when both cookie and header are absent', () => {
      expect(() => guard.canActivate(makeContext({ method: 'POST' }))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('token mismatch — should reject', () => {
    it('throws ForbiddenException when values differ', () => {
      expect(() =>
        guard.canActivate(
          makeContext({
            method: 'POST',
            cookies: { 'csrf-token': 'aaaaaa' },
            headers: { 'x-csrf-token': 'bbbbbb' },
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when lengths differ (avoids timingSafeEqual throw)', () => {
      expect(() =>
        guard.canActivate(
          makeContext({
            method: 'POST',
            cookies: { 'csrf-token': 'short' },
            headers: { 'x-csrf-token': 'much-longer-token' },
          }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('valid token — should allow', () => {
    const token = 'a'.repeat(64);

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      '%s with matching token passes',
      (method) => {
        expect(
          guard.canActivate(
            makeContext({
              method,
              cookies: { 'csrf-token': token },
              headers: { 'x-csrf-token': token },
            }),
          ),
        ).toBe(true);
      },
    );
  });
});
