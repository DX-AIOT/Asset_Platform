import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  IPaymentGateway,
  InitiateEscrowHoldParams,
  InitiateEscrowHoldResult,
  ReleaseEscrowParams,
  ReleaseEscrowResult,
  RefundBuyerParams,
  RefundBuyerResult,
} from '../interfaces/payment-gateway.interface';

@Injectable()
export class MoMoGatewayAdapter implements IPaymentGateway {
  private readonly logger = new Logger(MoMoGatewayAdapter.name);
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    this.partnerCode = config.getOrThrow<string>('MOMO_PARTNER_CODE');
    this.accessKey = config.getOrThrow<string>('MOMO_ACCESS_KEY');
    this.secretKey = config.getOrThrow<string>('MOMO_SECRET_KEY');
    this.endpoint = config.getOrThrow<string>('MOMO_ENDPOINT');
  }

  async initiateEscrowHold(params: InitiateEscrowHoldParams): Promise<InitiateEscrowHoldResult> {
    const { orderId, requestId, amount, orderInfo, redirectUrl, ipnUrl, extraData = '' } = params;
    const requestType = 'captureWallet';

    const rawSignature = [
      `accessKey=${this.accessKey}`,
      `amount=${amount}`,
      `extraData=${extraData}`,
      `ipnUrl=${ipnUrl}`,
      `orderId=${orderId}`,
      `orderInfo=${orderInfo}`,
      `partnerCode=${this.partnerCode}`,
      `redirectUrl=${redirectUrl}`,
      `requestId=${requestId}`,
      `requestType=${requestType}`,
    ].join('&');

    const signature = this.sign(rawSignature);

    const body = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang: 'vi',
    };

    const data = await this.post<{ resultCode: number; message: string; payUrl?: string }>('/v2/gateway/api/create', body);

    if (data.resultCode !== 0) {
      throw new Error(`MoMo initiateEscrowHold failed [${data.resultCode}]: ${data.message}`);
    }

    return {
      paymentUrl: data.payUrl!,
      orderId,
      requestId,
    };
  }

  async releaseEscrow(params: ReleaseEscrowParams): Promise<ReleaseEscrowResult> {
    const { orderId, requestId, amount, description = '' } = params;
    const requestType = 'capture';

    const rawSignature = [
      `accessKey=${this.accessKey}`,
      `amount=${amount}`,
      `description=${description}`,
      `orderId=${orderId}`,
      `partnerCode=${this.partnerCode}`,
      `requestId=${requestId}`,
      `requestType=${requestType}`,
    ].join('&');

    const signature = this.sign(rawSignature);

    const body = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      orderId,
      amount,
      description,
      requestType,
      signature,
      lang: 'vi',
    };

    const data = await this.post<{
      resultCode: number;
      message: string;
      transId?: string;
      orderId?: string;
      requestId?: string;
    }>('/v2/gateway/api/confirm', body);

    if (data.resultCode !== 0) {
      throw new Error(`MoMo releaseEscrow failed [${data.resultCode}]: ${data.message}`);
    }

    return {
      orderId: data.orderId ?? orderId,
      requestId: data.requestId ?? requestId,
      transId: data.transId ?? '',
      resultCode: data.resultCode,
      message: data.message,
    };
  }

  async refundBuyer(params: RefundBuyerParams): Promise<RefundBuyerResult> {
    const { orderId, requestId, amount, transId, description = '' } = params;

    const rawSignature = [
      `accessKey=${this.accessKey}`,
      `amount=${amount}`,
      `description=${description}`,
      `orderId=${orderId}`,
      `partnerCode=${this.partnerCode}`,
      `requestId=${requestId}`,
      `transId=${transId}`,
    ].join('&');

    const signature = this.sign(rawSignature);

    const body = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      orderId,
      amount,
      transId,
      description,
      signature,
      lang: 'vi',
    };

    const data = await this.post<{
      resultCode: number;
      message: string;
      orderId?: string;
      requestId?: string;
    }>('/v2/gateway/api/refund', body);

    if (data.resultCode !== 0) {
      throw new Error(`MoMo refundBuyer failed [${data.resultCode}]: ${data.message}`);
    }

    return {
      orderId: data.orderId ?? orderId,
      requestId: data.requestId ?? requestId,
      resultCode: data.resultCode,
      message: data.message,
    };
  }

  private sign(rawSignature: string): string {
    return createHmac('sha256', this.secretKey).update(rawSignature).digest('hex');
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.endpoint}${path}`;
    this.logger.debug(`POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`MoMo HTTP error ${response.status} at ${path}`);
    }

    return response.json() as Promise<T>;
  }
}
