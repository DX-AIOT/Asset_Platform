import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MoMoService } from './momo.service';
import { MoMoIpnPayload } from './momo.types';

const MOCK_CONFIG = {
  MOMO_BASE_URL: 'https://test-payment.momo.vn',
  MOMO_PARTNER_CODE: 'MOMOATM4',
  MOMO_ACCESS_KEY: 'F8BBA842ECF85',
  MOMO_SECRET_KEY: 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
  MOMO_REDIRECT_URL: 'https://app.example.com/pay/result',
  MOMO_IPN_URL: 'https://api.example.com/webhooks/momo/ipn',
};

describe('MoMoService', () => {
  let service: MoMoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MoMoService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const val = MOCK_CONFIG[key as keyof typeof MOCK_CONFIG];
              if (!val) throw new Error(`Missing config: ${key}`);
              return val;
            },
          },
        },
      ],
    }).compile();

    service = module.get(MoMoService);
  });

  describe('buildSignature', () => {
    it('produces consistent HMAC-SHA256 hex output', () => {
      const sig = service.buildSignature('hello world');
      expect(typeof sig).toBe('string');
      expect(sig).toHaveLength(64);
      // Same input → same output
      expect(service.buildSignature('hello world')).toBe(sig);
    });

    it('produces different outputs for different inputs', () => {
      const a = service.buildSignature('input-a');
      const b = service.buildSignature('input-b');
      expect(a).not.toBe(b);
    });
  });

  describe('verifyIpnSignature', () => {
    const makePayload = (overrides: Partial<MoMoIpnPayload> = {}): MoMoIpnPayload => {
      const base: Omit<MoMoIpnPayload, 'signature'> = {
        partnerCode: 'MOMOATM4',
        orderId: 'order-123',
        requestId: 'req-456',
        amount: 100000,
        orderInfo: 'Test payment',
        orderType: 'momo_wallet',
        transId: 9999,
        resultCode: 0,
        message: 'Successful.',
        payType: 'qr',
        responseTime: 1700000000000,
        extraData: '',
      };
      const rawHash =
        `accessKey=${MOCK_CONFIG.MOMO_ACCESS_KEY}` +
        `&amount=${base.amount}` +
        `&extraData=${base.extraData}` +
        `&message=${base.message}` +
        `&orderId=${base.orderId}` +
        `&orderInfo=${base.orderInfo}` +
        `&orderType=${base.orderType}` +
        `&partnerCode=${base.partnerCode}` +
        `&payType=${base.payType}` +
        `&requestId=${base.requestId}` +
        `&responseTime=${base.responseTime}` +
        `&resultCode=${base.resultCode}` +
        `&transId=${base.transId}`;
      const { createHmac } = require('crypto');
      const sig = createHmac('sha256', MOCK_CONFIG.MOMO_SECRET_KEY).update(rawHash).digest('hex');
      return { ...base, ...overrides, signature: overrides.signature ?? sig };
    };

    it('returns true for a valid signature', () => {
      expect(service.verifyIpnSignature(makePayload())).toBe(true);
    });

    it('returns false when signature is tampered', () => {
      const payload = makePayload({ signature: 'deadbeef' + '0'.repeat(56) });
      expect(service.verifyIpnSignature(payload)).toBe(false);
    });

    it('returns false when amount is changed but signature is original', () => {
      const payload = makePayload();
      payload.amount = 999999; // tamper amount after signature computed
      expect(service.verifyIpnSignature(payload)).toBe(false);
    });
  });
});
