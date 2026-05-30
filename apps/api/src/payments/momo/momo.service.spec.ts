import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MoMoGatewayAdapter } from '../adapters/momo-gateway.adapter';
import { IpnPayload } from '../interfaces/payment-gateway.interface';
import { createHmac } from 'crypto';

const MOCK = {
  MOMO_PARTNER_CODE: 'MOMOATM4',
  MOMO_ACCESS_KEY: 'F8BBA842ECF85',
  MOMO_SECRET_KEY: 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
  MOMO_ENDPOINT: 'https://test-payment.momo.vn',
};

function sign(raw: string): string {
  return createHmac('sha256', MOCK.MOMO_SECRET_KEY).update(raw).digest('hex');
}

function makeIpnPayload(overrides: Partial<IpnPayload> = {}): IpnPayload {
  const base: Omit<IpnPayload, 'signature'> = {
    partnerCode: MOCK.MOMO_PARTNER_CODE,
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
  const raw = [
    `accessKey=${MOCK.MOMO_ACCESS_KEY}`,
    `amount=${base.amount}`,
    `extraData=${base.extraData}`,
    `message=${base.message}`,
    `orderId=${base.orderId}`,
    `orderInfo=${base.orderInfo}`,
    `orderType=${base.orderType}`,
    `partnerCode=${base.partnerCode}`,
    `payType=${base.payType}`,
    `requestId=${base.requestId}`,
    `responseTime=${base.responseTime}`,
    `resultCode=${base.resultCode}`,
    `transId=${base.transId}`,
  ].join('&');

  return { ...base, ...overrides, signature: overrides.signature ?? sign(raw) };
}

describe('MoMoGatewayAdapter — verifyIpnSignature', () => {
  let adapter: MoMoGatewayAdapter;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MoMoGatewayAdapter,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const val = MOCK[key as keyof typeof MOCK];
              if (!val) throw new Error(`Missing config: ${key}`);
              return val;
            },
          },
        },
      ],
    }).compile();
    adapter = module.get(MoMoGatewayAdapter);
  });

  it('returns true for a valid signature', () => {
    expect(adapter.verifyIpnSignature(makeIpnPayload())).toBe(true);
  });

  it('returns false for a tampered signature', () => {
    expect(adapter.verifyIpnSignature(makeIpnPayload({ signature: 'deadbeef' + '0'.repeat(56) }))).toBe(false);
  });

  it('returns false when amount is changed after signing', () => {
    const payload = makeIpnPayload();
    payload.amount = 999999;
    expect(adapter.verifyIpnSignature(payload)).toBe(false);
  });
});
