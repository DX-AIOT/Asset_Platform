import { ConfigService } from '@nestjs/config';
import { MoMoGatewayAdapter } from '../src/payments/adapters/momo-gateway.adapter';

const MOCK_CONFIG: Record<string, string> = {
  MOMO_PARTNER_CODE: 'MOMO_TEST',
  MOMO_ACCESS_KEY: 'F8BBA842ECF85',
  MOMO_SECRET_KEY: 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
  MOMO_ENDPOINT: 'https://test-payment.momo.vn',
};

function makeConfig(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (!(key in MOCK_CONFIG)) throw new Error(`Missing required config: ${key}`);
      return MOCK_CONFIG[key];
    }),
  } as unknown as ConfigService;
}

function mockFetch(body: unknown, ok = true): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok,
    json: async () => body,
  } as Response);
}

describe('MoMoGatewayAdapter', () => {
  let adapter: MoMoGatewayAdapter;

  beforeEach(() => {
    adapter = new MoMoGatewayAdapter(makeConfig());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initiateEscrowHold', () => {
    it('returns paymentUrl and ids on success', async () => {
      mockFetch({
        resultCode: 0,
        payUrl: 'https://payment.momo.vn/pay?token=abc123',
        orderId: 'ORDER-001',
        requestId: 'REQ-001',
        message: 'Success',
      });

      const result = await adapter.initiateEscrowHold({
        orderId: 'ORDER-001',
        requestId: 'REQ-001',
        amount: 100000,
        orderInfo: 'Test item',
        redirectUrl: 'https://example.com/redirect',
        ipnUrl: 'https://example.com/ipn',
      });

      expect(result.paymentUrl).toBe('https://payment.momo.vn/pay?token=abc123');
      expect(result.orderId).toBe('ORDER-001');
      expect(result.requestId).toBe('REQ-001');
    });

    it('POSTs to the create endpoint with correct URL', async () => {
      const spy = mockFetch({ resultCode: 0, payUrl: 'https://payment.momo.vn/p', message: 'Success' });

      await adapter.initiateEscrowHold({
        orderId: 'ORD',
        requestId: 'REQ',
        amount: 50000,
        orderInfo: 'info',
        redirectUrl: 'https://r.com',
        ipnUrl: 'https://ipn.com',
      });

      expect(spy).toHaveBeenCalledWith(
        'https://test-payment.momo.vn/v2/gateway/api/create',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('sends requestType=captureWallet in body', async () => {
      const spy = mockFetch({ resultCode: 0, payUrl: 'https://p', message: 'ok' });

      await adapter.initiateEscrowHold({
        orderId: 'ORD',
        requestId: 'REQ',
        amount: 50000,
        orderInfo: 'info',
        redirectUrl: 'https://r.com',
        ipnUrl: 'https://ipn.com',
      });

      const callBody = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.requestType).toBe('captureWallet');
    });

    it('throws on non-zero resultCode', async () => {
      mockFetch({ resultCode: 1001, message: 'Invalid signature' });

      await expect(
        adapter.initiateEscrowHold({
          orderId: 'ORD',
          requestId: 'REQ',
          amount: 50000,
          orderInfo: 'info',
          redirectUrl: 'https://r.com',
          ipnUrl: 'https://ipn.com',
        }),
      ).rejects.toThrow('MoMo initiateEscrowHold failed [1001]');
    });

    it('throws on HTTP error response', async () => {
      mockFetch({}, false);

      await expect(
        adapter.initiateEscrowHold({
          orderId: 'ORD',
          requestId: 'REQ',
          amount: 50000,
          orderInfo: 'info',
          redirectUrl: 'https://r.com',
          ipnUrl: 'https://ipn.com',
        }),
      ).rejects.toThrow('MoMo HTTP error');
    });
  });

  describe('releaseEscrow', () => {
    it('returns transId and resultCode on success', async () => {
      mockFetch({
        resultCode: 0,
        transId: 'TRANS-001',
        orderId: 'ORDER-001',
        requestId: 'REQ-CAP-001',
        message: 'Success',
      });

      const result = await adapter.releaseEscrow({
        orderId: 'ORDER-001',
        requestId: 'REQ-CAP-001',
        amount: 100000,
      });

      expect(result.transId).toBe('TRANS-001');
      expect(result.resultCode).toBe(0);
      expect(result.orderId).toBe('ORDER-001');
    });

    it('POSTs to the confirm endpoint', async () => {
      const spy = mockFetch({ resultCode: 0, transId: 'T', orderId: 'O', requestId: 'R', message: 'ok' });

      await adapter.releaseEscrow({ orderId: 'O', requestId: 'R', amount: 1000 });

      expect(spy).toHaveBeenCalledWith(
        'https://test-payment.momo.vn/v2/gateway/api/confirm',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on capture failure', async () => {
      mockFetch({ resultCode: 1006, message: 'Order does not exist' });

      await expect(
        adapter.releaseEscrow({ orderId: 'BAD', requestId: 'REQ', amount: 1000 }),
      ).rejects.toThrow('MoMo releaseEscrow failed [1006]');
    });
  });

  describe('refundBuyer', () => {
    it('returns resultCode 0 on success', async () => {
      mockFetch({
        resultCode: 0,
        orderId: 'ORDER-001',
        requestId: 'REQ-REF-001',
        transId: 'TRANS-REF-001',
        message: 'Success',
      });

      const result = await adapter.refundBuyer({
        orderId: 'ORDER-001',
        requestId: 'REQ-REF-001',
        amount: 100000,
        transId: 'TRANS-001',
      });

      expect(result.resultCode).toBe(0);
      expect(result.orderId).toBe('ORDER-001');
    });

    it('POSTs to the refund endpoint', async () => {
      const spy = mockFetch({ resultCode: 0, orderId: 'O', requestId: 'R', message: 'ok' });

      await adapter.refundBuyer({ orderId: 'O', requestId: 'R', amount: 1000, transId: 'T' });

      expect(spy).toHaveBeenCalledWith(
        'https://test-payment.momo.vn/v2/gateway/api/refund',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on refund failure', async () => {
      mockFetch({ resultCode: 1005, message: 'Transaction not found' });

      await expect(
        adapter.refundBuyer({ orderId: 'O', requestId: 'R', amount: 1000, transId: 'T' }),
      ).rejects.toThrow('MoMo refundBuyer failed [1005]');
    });
  });

  describe('signature', () => {
    it('includes a non-empty signature field in the request body', async () => {
      const spy = mockFetch({ resultCode: 0, payUrl: 'https://p', message: 'ok' });

      await adapter.initiateEscrowHold({
        orderId: 'ORD',
        requestId: 'REQ',
        amount: 50000,
        orderInfo: 'info',
        redirectUrl: 'https://r.com',
        ipnUrl: 'https://ipn.com',
      });

      const callBody = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
      expect(typeof callBody.signature).toBe('string');
      expect(callBody.signature.length).toBe(64); // SHA-256 hex = 64 chars
    });
  });
});
