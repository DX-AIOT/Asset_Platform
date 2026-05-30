import { ConfigService } from '@nestjs/config';

export interface MoMoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  baseUrl: string;
  redirectUrl: string;
  ipnUrl: string;
}

export function momoConfig(configService: ConfigService): MoMoConfig {
  return {
    partnerCode: configService.get<string>('MOMO_PARTNER_CODE', ''),
    accessKey: configService.get<string>('MOMO_ACCESS_KEY', ''),
    secretKey: configService.get<string>('MOMO_SECRET_KEY', ''),
    baseUrl: configService.get<string>('MOMO_BASE_URL', 'https://test-payment.momo.vn'),
    redirectUrl: configService.get<string>('MOMO_REDIRECT_URL', ''),
    ipnUrl: configService.get<string>('MOMO_IPN_URL', ''),
  };
}
