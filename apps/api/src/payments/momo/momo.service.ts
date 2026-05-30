import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  MoMoCreatePaymentResponse,
  MoMoIpnPayload,
  MoMoQueryStatusResponse,
  MoMoRefundResponse,
} from './momo.types';

@Injectable()
export class MoMoService {
  private readonly logger = new Logger(MoMoService.name);
  private readonly baseUrl: string;
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly redirectUrl: string;
  private readonly ipnUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('MOMO_BASE_URL');
    this.partnerCode = config.getOrThrow<string>('MOMO_PARTNER_CODE');
    this.accessKey = config.getOrThrow<string>('MOMO_ACCESS_KEY');
    this.secretKey = config.getOrThrow<string>('MOMO_SECRET_KEY');
    this.redirectUrl = config.getOrThrow<string>('MOMO_REDIRECT_URL');
    this.ipnUrl = config.getOrThrow<string>('MOMO_IPN_URL');
  }

  async createPayment(
    orderId: string,
    requestId: string,
    amount: number,
    orderInfo: string,
  ): Promise<MoMoCreatePaymentResponse> {
    const extraData = '';
    const rawHash =
      `accessKey=${this.accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${this.ipnUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${this.partnerCode}` +
      `&redirectUrl=${this.redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=captureWallet`;

    const signature = this.buildSignature(rawHash);

    const body = {
      partnerCode: this.partnerCode,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      requestType: 'captureWallet' as const,
      extraData,
      lang: 'vi' as const,
      signature,
    };

    const res = await fetch(`${this.baseUrl}/v2/gateway/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as MoMoCreatePaymentResponse;
    this.logger.log(`createPayment orderId=${orderId} resultCode=${data.resultCode}`);
    return data;
  }

  async queryStatus(orderId: string, requestId: string): Promise<MoMoQueryStatusResponse> {
    const rawHash =
      `accessKey=${this.accessKey}` +
      `&orderId=${orderId}` +
      `&partnerCode=${this.partnerCode}` +
      `&requestId=${requestId}`;

    const signature = this.buildSignature(rawHash);

    const body = {
      partnerCode: this.partnerCode,
      requestId,
      orderId,
      lang: 'vi' as const,
      signature,
    };

    const res = await fetch(`${this.baseUrl}/v2/gateway/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return (await res.json()) as MoMoQueryStatusResponse;
  }

  async refund(
    orderId: string,
    requestId: string,
    transId: number,
    amount: number,
    description: string,
  ): Promise<MoMoRefundResponse> {
    const rawHash =
      `accessKey=${this.accessKey}` +
      `&amount=${amount}` +
      `&description=${description}` +
      `&orderId=${orderId}` +
      `&partnerCode=${this.partnerCode}` +
      `&requestId=${requestId}` +
      `&transId=${transId}`;

    const signature = this.buildSignature(rawHash);

    const body = {
      partnerCode: this.partnerCode,
      orderId,
      requestId,
      amount,
      transId,
      lang: 'vi' as const,
      description,
      signature,
    };

    const res = await fetch(`${this.baseUrl}/v2/gateway/api/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return (await res.json()) as MoMoRefundResponse;
  }

  verifyIpnSignature(payload: MoMoIpnPayload): boolean {
    const rawHash =
      `accessKey=${this.accessKey}` +
      `&amount=${payload.amount}` +
      `&extraData=${payload.extraData}` +
      `&message=${payload.message}` +
      `&orderId=${payload.orderId}` +
      `&orderInfo=${payload.orderInfo}` +
      `&orderType=${payload.orderType}` +
      `&partnerCode=${payload.partnerCode}` +
      `&payType=${payload.payType}` +
      `&requestId=${payload.requestId}` +
      `&responseTime=${payload.responseTime}` +
      `&resultCode=${payload.resultCode}` +
      `&transId=${payload.transId}`;

    const expected = this.buildSignature(rawHash);
    return expected === payload.signature;
  }

  buildSignature(rawHashString: string): string {
    return createHmac('sha256', this.secretKey).update(rawHashString).digest('hex');
  }
}
