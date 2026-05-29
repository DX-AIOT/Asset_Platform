import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';

export const CSRF_COOKIE_NAME = 'csrf-token';

@Injectable()
export class CsrfService {
  constructor(private readonly configService: ConfigService) {}

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

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
