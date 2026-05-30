import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Dual-path activation: routes decorated with @Public() bypass JWT validation entirely
   * (used for register, login, Google OAuth, and the sharing invite-accept link).
   * All other routes delegate to Passport's JWT strategy, which reads the token from
   * either the `access_token` httpOnly cookie (web) or the `Authorization: Bearer`
   * header (mobile/API clients).
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
