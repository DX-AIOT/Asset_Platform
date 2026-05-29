import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';
import { CSRF_COOKIE_NAME } from '../csrf.service';

@Injectable()
export class CsrfGuard implements CanActivate {
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  private static readonly CSRF_HEADER = 'x-csrf-token';

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (CsrfGuard.SAFE_METHODS.has(request.method)) {
      return true;
    }

    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipCsrf) return true;

    // @Public() routes (login, register, refresh) set the cookie; they have no token yet
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const cookieToken: string | undefined = request.cookies?.[CSRF_COOKIE_NAME];
    const rawHeader = request.headers[CsrfGuard.CSRF_HEADER];
    const headerToken: string | undefined =
      typeof rawHeader === 'string' ? rawHeader : undefined;

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('CSRF token missing');
    }

    // timingSafeEqual requires equal-length buffers
    if (cookieToken.length !== headerToken.length) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);
    if (!crypto.timingSafeEqual(cookieBuf, headerBuf)) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    return true;
  }
}
