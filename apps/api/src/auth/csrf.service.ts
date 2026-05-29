import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';

export const CSRF_COOKIE_NAME = 'csrf-token';

@Injectable()
export class CsrfService {
  constructor(private readonly configService: ConfigService) {}

  /** Generates a cryptographically random 32-byte hex CSRF token. */
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Writes the CSRF token into a non-httpOnly cookie so the browser's JavaScript
   * can read it and send it back as the `x-csrf-token` request header.
   * This implements the "cookie-to-header" CSRF protection pattern.
   * sameSite is `lax` in development to allow cross-origin requests from localhost.
   */
  setCsrfCookie(res: Response, token: string): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // JS must be able to read this to send the header
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });
  }
}
