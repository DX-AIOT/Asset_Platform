import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MoMoService } from '../src/payments/momo/momo.service';
import { MoMoIpnPayload } from '../src/payments/momo/momo.types';

// MoMo sandbox test credentials (public fixture values from MoMo docs)
const PARTNER_CODE = 'MOMO';
const ACCESS_KEY = 'F8BBA842ECF85';
const SECRET_KEY = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
const BASE_URL = 'https://test-payment.momo.vn';
const REDIRECT_URL = 'https://example.com/redirect';
const IPN_URL = 'https://example.com/ipn';

function makeService(): MoMoService {
  const map: Record<string, string> = {
    MOMO_PARTNER_CODE: PARTNER_CODE,
    MOMO_ACCESS_KEY: ACCESS_KEY,
    MOMO_SECRET_KEY: SECRET_KEY,
    MOMO_BASE_URL: BASE_URL,
    MOMO_REDIRECT_URL: REDIRECT_URL,
    MOMO_IPN_URL: IPN_URL,
  };
  const configService = {
    get: (key: string, defaultVal?: string): string => map[key] ?? defaultVal ?? '',
    getOrThrow: (key: string): string => {
      if (!(key in map)) throw new Error(`Missing config: ${key}`);
      return map[key];
    },
  } as unknown as ConfigService;

  return new MoMoService(configService);
}

function hmac256(raw: string): string {
  return createHmac('sha256', SECRET_KEY).update(raw).digest('hex');
}

describe('MoMoService', () => {
  let service: MoMoService;

  beforeEach(() => {
    service = makeService();
  });

  // ── Signature generation ────────────────────────────────────────────────

  describe('buildSignature', () => {
    it('produces correct HMAC-SHA256 hex digest', () => {
      const raw = 'accessKey=F8BBA842ECF85&amount=50000&partnerCode=MOMO';
      expect(service.buildSignature(raw)).toBe(hmac256(raw));
    });

    it('output is lowercase hex, 64 chars', () => {
      expect(service.buildSignature('test')).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── createPayment rawHashString ─────────────────────────────────────────

  describe('createPayment', () => {
    it('builds correct HMAC-SHA256 signature matching captureWallet raw hash', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            partnerCode: PARTNER_CODE,
            requestId: 'REQ-001',
            orderId: 'ORDER-001',
            resultCode: 0,
            message: 'Successful.',
            responseTime: 1625132005609,
            payUrl: 'https://pay.momo.vn/abc',
          }),
      } as any);

      const orderId = 'ORDER-001';
      const requestId = 'REQ-001';
      const amount = 50000;
      const orderInfo = 'pay with MoMo';

      await service.createPayment(orderId, requestId, amount, orderInfo);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v2/gateway/api/create`);

      const body = JSON.parse(init.body as string);
      const expectedRaw = [
        `accessKey=${ACCESS_KEY}`,
        `amount=${amount}`,
        `extraData=`,
        `ipnUrl=${IPN_URL}`,
        `orderId=${orderId}`,
        `orderInfo=${orderInfo}`,
        `partnerCode=${PARTNER_CODE}`,
        `redirectUrl=${REDIRECT_URL}`,
        `requestId=${requestId}`,
        `requestType=captureWallet`,
      ].join('&');

      expect(body.signature).toBe(hmac256(expectedRaw));
      fetchSpy.mockRestore();
    });

    it('returns the MoMo API response object', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            resultCode: 0,
            payUrl: 'https://pay.momo.vn/abc',
          }),
      } as any);

      const result = await service.createPayment('o1', 'r1', 10000, 'test');
      expect(result.payUrl).toBe('https://pay.momo.vn/abc');
    });
  });

  // ── IPN signature verification ──────────────────────────────────────────

  describe('verifyIpnSignature', () => {
    function makePayload(overrides: Partial<MoMoIpnPayload> = {}): MoMoIpnPayload {
      const base: Omit<MoMoIpnPayload, 'signature'> = {
        partnerCode: PARTNER_CODE,
        orderId: 'ORDER-001',
        requestId: 'REQ-001',
        amount: 50000,
        orderInfo: 'pay with MoMo',
        orderType: 'momo_wallet',
        transId: 3456789012,
        resultCode: 0,
        message: 'Successful.',
        payType: 'qr',
        responseTime: 1625132005609,
        extraData: '',
      };
      const merged = { ...base, ...overrides };

      // Build signature over merged fields (overrides.signature bypasses this)
      if (!overrides.signature) {
        const rawHashString = [
          `accessKey=${ACCESS_KEY}`,
          `amount=${merged.amount}`,
          `extraData=${merged.extraData}`,
          `message=${merged.message}`,
          `orderId=${merged.orderId}`,
          `orderInfo=${merged.orderInfo}`,
          `orderType=${merged.orderType}`,
          `partnerCode=${merged.partnerCode}`,
          `payType=${merged.payType}`,
          `requestId=${merged.requestId}`,
          `responseTime=${merged.responseTime}`,
          `resultCode=${merged.resultCode}`,
          `transId=${merged.transId}`,
        ].join('&');
        return { ...merged, signature: hmac256(rawHashString) };
      }

      return { ...merged, signature: overrides.signature };
    }

    it('returns true for a correctly signed IPN payload', () => {
      expect(service.verifyIpnSignature(makePayload())).toBe(true);
    });

    it('returns false for a tampered signature string', () => {
      const payload = makePayload({ signature: 'deadbeef'.repeat(8) });
      expect(service.verifyIpnSignature(payload)).toBe(false);
    });

    it('returns false when amount is modified after signing', () => {
      const payload = makePayload();
      payload.amount = 1; // tampered
      expect(service.verifyIpnSignature(payload)).toBe(false);
    });

    it('returns false when orderId is modified after signing', () => {
      const payload = makePayload();
      payload.orderId = 'FRAUD-ORDER';
      expect(service.verifyIpnSignature(payload)).toBe(false);
    });
  });
});
