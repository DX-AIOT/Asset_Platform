import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionsService } from '../src/transactions/transactions.service';
import {
  Transaction,
  TransactionStatus,
} from '../src/transactions/entities/transaction.entity';
import { Listing, ListingStatus } from '../src/marketplace/entities/listing.entity';
import { IPaymentGateway, IpnPayload } from '../src/payments/interfaces/payment-gateway.interface';

// ── Factories ────────────────────────────────────────────────────────────────

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    itemId: 'item-1',
    sellerId: 'seller-1',
    price: 100000,
    currency: 'VND',
    status: ListingStatus.ACTIVE,
    ...overrides,
  } as Listing;
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    listingId: 'listing-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    amountVND: 100000,
    status: TransactionStatus.PENDING_PAYMENT,
    momoOrderId: 'DXS-abcdef1234567890',
    momoRequestId: 'REQ-abcdef1234567890',
    momoPaymentUrl: 'https://payment.momo.vn/pay?token=abc',
    momoTransId: null,
    escrowHeldAt: null,
    releasedAt: null,
    releaseAfter: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Transaction;
}

function makeIpnPayload(overrides: Partial<IpnPayload> = {}): IpnPayload {
  return {
    partnerCode: 'MOMO',
    orderId: 'DXS-abcdef1234567890',
    requestId: 'REQ-abcdef1234567890',
    amount: 100000,
    orderInfo: 'Purchase listing listing-1',
    orderType: 'momo_wallet',
    transId: 9999,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1700000000000,
    extraData: '',
    signature: 'valid-sig',
    ...overrides,
  };
}

function makeService(opts: {
  txs?: Transaction[];
  listings?: Listing[];
  gatewayOverrides?: Partial<IPaymentGateway>;
  configOverrides?: Record<string, string | number>;
}) {
  const { txs = [], listings = [], gatewayOverrides = {}, configOverrides = {} } = opts;

  const config = {
    MOMO_REDIRECT_URL: 'https://example.com/redirect',
    MOMO_IPN_URL: 'https://example.com/ipn',
    ESCROW_AUTO_RELEASE_DAYS: 7,
    ...configOverrides,
  };

  const txRepo: any = {
    create: jest.fn().mockImplementation((data) => ({ id: 'tx-new', ...data } as Transaction)),
    save: jest.fn().mockImplementation((tx) => Promise.resolve(tx)),
    findOne: jest.fn().mockImplementation(({ where }) => {
      const found = txs.find(
        (t) =>
          (where.id && t.id === where.id) ||
          (where.momoOrderId && t.momoOrderId === where.momoOrderId),
      );
      return Promise.resolve(found ?? null);
    }),
    find: jest.fn().mockResolvedValue([]),
  };

  const disputeRepo: any = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => ({ id: 'dispute-1', ...data })),
    save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
  };

  const listingRepo: any = {
    findOne: jest.fn().mockImplementation(({ where }) => {
      const found = listings.find((l) => l.id === where.id);
      return Promise.resolve(found ?? null);
    }),
    save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
  };

  const gateway: IPaymentGateway = {
    initiateEscrowHold: jest.fn().mockResolvedValue({
      paymentUrl: 'https://payment.momo.vn/pay?token=abc',
      orderId: 'DXS-abcdef1234567890',
      requestId: 'REQ-abcdef1234567890',
    }),
    releaseEscrow: jest.fn().mockResolvedValue({ resultCode: 0, message: 'ok', transId: 'T', orderId: 'O', requestId: 'R' }),
    refundBuyer: jest.fn().mockResolvedValue({ resultCode: 0, message: 'ok', orderId: 'O', requestId: 'R' }),
    verifyIpnSignature: jest.fn().mockReturnValue(true),
    ...gatewayOverrides,
  };

  const configService = {
    getOrThrow: (key: string) => {
      if (!(key in config)) throw new Error(`Missing config: ${key}`);
      return config[key as keyof typeof config];
    },
    get: (key: string, defaultVal?: unknown) => config[key as keyof typeof config] ?? defaultVal,
  } as unknown as ConfigService;

  const service = new TransactionsService(txRepo, disputeRepo, listingRepo, gateway, configService);

  return { service, txRepo, disputeRepo, listingRepo, gateway };
}

// ── initiate ─────────────────────────────────────────────────────────────────

describe('TransactionsService.initiate', () => {
  it('creates a transaction and returns payUrl', async () => {
    const listing = makeListing();
    const { service, txRepo } = makeService({ listings: [listing] });

    const result = await service.initiate('listing-1', 'buyer-1');

    expect(txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: 'listing-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.PENDING_PAYMENT,
      }),
    );
    expect(result.payUrl).toBe('https://payment.momo.vn/pay?token=abc');
    expect(result.transactionId).toBeDefined();
  });

  it('throws NotFoundException when listing does not exist', async () => {
    const { service } = makeService({ listings: [] });
    await expect(service.initiate('no-such-listing', 'buyer-1')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when listing is not ACTIVE', async () => {
    const listing = makeListing({ status: ListingStatus.SOLD });
    const { service } = makeService({ listings: [listing] });
    await expect(service.initiate('listing-1', 'buyer-1')).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException when buyer is the seller', async () => {
    const listing = makeListing({ sellerId: 'same-user' });
    const { service } = makeService({ listings: [listing] });
    await expect(service.initiate('listing-1', 'same-user')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('saves momoOrderId, momoRequestId, and payUrl onto transaction', async () => {
    const listing = makeListing();
    const { service, txRepo } = makeService({ listings: [listing] });

    await service.initiate('listing-1', 'buyer-1');

    const savedTx = txRepo.save.mock.calls[1]?.[0] ?? txRepo.save.mock.calls[0]?.[0];
    expect(savedTx.momoPaymentUrl).toBe('https://payment.momo.vn/pay?token=abc');
  });
});

// ── getTransaction ────────────────────────────────────────────────────────────

describe('TransactionsService.getTransaction', () => {
  it('returns transaction when buyer requests it', async () => {
    const tx = makeTx();
    const { service } = makeService({ txs: [tx] });
    const result = await service.getTransaction('tx-1', 'buyer-1');
    expect(result).toBe(tx);
  });

  it('returns transaction when seller requests it', async () => {
    const tx = makeTx();
    const { service } = makeService({ txs: [tx] });
    const result = await service.getTransaction('tx-1', 'seller-1');
    expect(result).toBe(tx);
  });

  it('throws NotFoundException when tx does not exist', async () => {
    const { service } = makeService({ txs: [] });
    await expect(service.getTransaction('no-such', 'buyer-1')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when caller is neither buyer nor seller', async () => {
    const tx = makeTx();
    const { service } = makeService({ txs: [tx] });
    await expect(service.getTransaction('tx-1', 'intruder-x')).rejects.toThrow(ForbiddenException);
  });
});

// ── handleIpn ─────────────────────────────────────────────────────────────────

describe('TransactionsService.handleIpn', () => {
  it('transitions PENDING_PAYMENT → ESCROW_HELD on resultCode=0 with valid signature', async () => {
    const tx = makeTx();
    const { service, txRepo } = makeService({ txs: [tx] });

    await service.handleIpn(makeIpnPayload({ resultCode: 0 }));

    expect(txRepo.save).toHaveBeenCalled();
    const saved: Transaction = txRepo.save.mock.calls[0][0];
    expect(saved.status).toBe(TransactionStatus.ESCROW_HELD);
    expect(saved.escrowHeldAt).toBeInstanceOf(Date);
    expect(saved.releaseAfter).toBeInstanceOf(Date);
  });

  it('sets momoTransId on ESCROW_HELD transition', async () => {
    const tx = makeTx();
    const { service, txRepo } = makeService({ txs: [tx] });

    await service.handleIpn(makeIpnPayload({ transId: 42 }));

    const saved: Transaction = txRepo.save.mock.calls[0][0];
    expect(saved.momoTransId).toBe('42');
  });

  it('transitions PENDING_PAYMENT → PAYMENT_FAILED on non-zero resultCode', async () => {
    const tx = makeTx();
    const { service, txRepo } = makeService({ txs: [tx] });

    await service.handleIpn(makeIpnPayload({ resultCode: 1006 }));

    const saved: Transaction = txRepo.save.mock.calls[0][0];
    expect(saved.status).toBe(TransactionStatus.PAYMENT_FAILED);
  });

  it('does NOT save when signature is invalid (tamper-resistant)', async () => {
    const tx = makeTx();
    const { service, txRepo } = makeService({
      txs: [tx],
      gatewayOverrides: { verifyIpnSignature: jest.fn().mockReturnValue(false) },
    });

    await service.handleIpn(makeIpnPayload({ signature: 'tampered' }));

    expect(txRepo.save).not.toHaveBeenCalled();
    expect(tx.status).toBe(TransactionStatus.PENDING_PAYMENT);
  });

  it('is idempotent — skips already-processed transactions', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service, txRepo } = makeService({ txs: [tx] });

    await service.handleIpn(makeIpnPayload());

    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('handles unknown orderId gracefully without throwing', async () => {
    const { service } = makeService({ txs: [] });
    await expect(service.handleIpn(makeIpnPayload())).resolves.toBeUndefined();
  });
});

// ── confirmReceipt ────────────────────────────────────────────────────────────

describe('TransactionsService.confirmReceipt', () => {
  it('transitions ESCROW_HELD → RELEASED_TO_SELLER for the buyer', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service, txRepo } = makeService({ txs: [tx] });

    const result = await service.confirmReceipt('tx-1', 'buyer-1');

    expect(result.status).toBe(TransactionStatus.RELEASED_TO_SELLER);
    expect(result.releasedAt).toBeInstanceOf(Date);
    expect(txRepo.save).toHaveBeenCalled();
  });

  it('throws ForbiddenException when non-buyer tries to confirm', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service } = makeService({ txs: [tx] });

    await expect(service.confirmReceipt('tx-1', 'seller-1')).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when transaction does not exist', async () => {
    const { service } = makeService({ txs: [] });
    await expect(service.confirmReceipt('no-such', 'buyer-1')).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException when status is not ESCROW_HELD', async () => {
    const tx = makeTx({ status: TransactionStatus.PENDING_PAYMENT });
    const { service } = makeService({ txs: [tx] });

    await expect(service.confirmReceipt('tx-1', 'buyer-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});
