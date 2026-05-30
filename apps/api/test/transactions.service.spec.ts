import {
  ForbiddenException,
  InternalServerErrorException,
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
import { DisputeRecord, DisputeStatus } from '../src/transactions/entities/dispute-record.entity';
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
    releaseAttempts: 0,
    nextReleaseAttemptAt: null,
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
    find: jest.fn().mockResolvedValue([]),
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

  it('returns momoOrderId in response', async () => {
    const listing = makeListing();
    const { service } = makeService({ listings: [listing] });

    const result = await service.initiate('listing-1', 'buyer-1');

    expect(result.momoOrderId).toMatch(/^DXS-/);
  });

  it('locks listing to INACTIVE before calling the gateway', async () => {
    const listing = makeListing();
    const { service, listingRepo } = makeService({ listings: [listing] });

    await service.initiate('listing-1', 'buyer-1');

    const firstListingSave = listingRepo.save.mock.calls[0]?.[0];
    expect(firstListingSave?.status).toBe(ListingStatus.INACTIVE);
  });

  it('unlocks listing and sets PAYMENT_FAILED when gateway throws', async () => {
    const listing = makeListing();
    const { service, txRepo, listingRepo } = makeService({
      listings: [listing],
      gatewayOverrides: {
        initiateEscrowHold: jest.fn().mockRejectedValue(new Error('MoMo timeout')),
      },
    });

    await expect(service.initiate('listing-1', 'buyer-1')).rejects.toThrow();

    const savedStatuses = txRepo.save.mock.calls.map((c: any) => c[0].status);
    expect(savedStatuses).toContain(TransactionStatus.PAYMENT_FAILED);
    const savedListingStatuses = listingRepo.save.mock.calls.map((c: any) => c[0].status);
    expect(savedListingStatuses).toContain(ListingStatus.ACTIVE);
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

  // Amount verification

  it('transitions to PAYMENT_FAILED when IPN amount does not match stored amountVND', async () => {
    const tx = makeTx({ amountVND: 100000 });
    const { service, txRepo } = makeService({ txs: [tx] });

    await service.handleIpn(makeIpnPayload({ resultCode: 0, amount: 50000 }));

    const saved: Transaction = txRepo.save.mock.calls[0][0];
    expect(saved.status).toBe(TransactionStatus.PAYMENT_FAILED);
    expect(saved.escrowHeldAt).toBeNull();
  });

  it('unlocks listing on amount mismatch', async () => {
    const tx = makeTx({ amountVND: 100000 });
    const listing = makeListing({ status: ListingStatus.INACTIVE });
    const { service, listingRepo } = makeService({ txs: [tx], listings: [listing] });

    await service.handleIpn(makeIpnPayload({ resultCode: 0, amount: 1 }));

    const savedListing = listingRepo.save.mock.calls[0]?.[0];
    expect(savedListing?.status).toBe(ListingStatus.ACTIVE);
  });

  // Listing unlock on payment failure

  it('unlocks listing (INACTIVE → ACTIVE) on non-zero resultCode', async () => {
    const tx = makeTx();
    const listing = makeListing({ status: ListingStatus.INACTIVE });
    const { service, listingRepo } = makeService({ txs: [tx], listings: [listing] });

    await service.handleIpn(makeIpnPayload({ resultCode: 1006 }));

    const savedListing = listingRepo.save.mock.calls[0]?.[0];
    expect(savedListing?.status).toBe(ListingStatus.ACTIVE);
  });

  it('does NOT call listingRepo.save when listing is already ACTIVE on failure', async () => {
    const tx = makeTx();
    const listing = makeListing({ status: ListingStatus.ACTIVE });
    const { service, listingRepo } = makeService({ txs: [tx], listings: [listing] });

    await service.handleIpn(makeIpnPayload({ resultCode: 1006 }));

    expect(listingRepo.save).not.toHaveBeenCalled();
  });
});

// ── confirmReceipt ────────────────────────────────────────────────────────────

describe('TransactionsService.confirmReceipt', () => {
  it('calls gateway.releaseEscrow and transitions ESCROW_HELD → RELEASED_TO_SELLER', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const listing = makeListing({ status: ListingStatus.INACTIVE });
    const { service, txRepo, gateway } = makeService({ txs: [tx], listings: [listing] });

    const result = await service.confirmReceipt('tx-1', 'buyer-1');

    expect(gateway.releaseEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: tx.momoOrderId, amount: tx.amountVND }),
    );
    expect(result.status).toBe(TransactionStatus.RELEASED_TO_SELLER);
    expect(result.releasedAt).toBeInstanceOf(Date);
    expect(txRepo.save).toHaveBeenCalled();
  });

  it('marks listing as SOLD on successful gateway release', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const listing = makeListing({ status: ListingStatus.INACTIVE });
    const { service, listingRepo } = makeService({ txs: [tx], listings: [listing] });

    await service.confirmReceipt('tx-1', 'buyer-1');

    const savedListing = listingRepo.save.mock.calls[0]?.[0];
    expect(savedListing?.status).toBe(ListingStatus.SOLD);
  });

  it('schedules retry when gateway throws — status stays ESCROW_HELD, releaseAttempts=1', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service, txRepo } = makeService({
      txs: [tx],
      gatewayOverrides: {
        releaseEscrow: jest.fn().mockRejectedValue(new Error('MoMo timeout')),
      },
    });

    const result = await service.confirmReceipt('tx-1', 'buyer-1');

    expect(result.status).toBe(TransactionStatus.ESCROW_HELD);
    expect(result.releaseAttempts).toBe(1);
    expect(result.nextReleaseAttemptAt).toBeInstanceOf(Date);
    expect(txRepo.save).toHaveBeenCalled();
  });

  it('transitions to RELEASE_FAILED when all retry slots are exhausted', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD, releaseAttempts: 3 });
    const { service } = makeService({
      txs: [tx],
      gatewayOverrides: {
        releaseEscrow: jest.fn().mockRejectedValue(new Error('permanent failure')),
      },
    });

    const result = await service.confirmReceipt('tx-1', 'buyer-1');

    expect(result.status).toBe(TransactionStatus.RELEASE_FAILED);
    expect(result.nextReleaseAttemptAt).toBeNull();
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

// ── raiseDispute ──────────────────────────────────────────────────────────────

describe('TransactionsService.raiseDispute', () => {
  it('transitions ESCROW_HELD → DISPUTED and creates a DisputeRecord', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service, txRepo, disputeRepo } = makeService({ txs: [tx] });

    const result = await service.raiseDispute('tx-1', 'buyer-1', 'item not as described');

    expect(result.status).toBe(TransactionStatus.DISPUTED);
    expect(txRepo.save).toHaveBeenCalled();
    expect(disputeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'tx-1', raisedByUserId: 'buyer-1' }),
    );
    expect(disputeRepo.save).toHaveBeenCalled();
  });

  it('throws ForbiddenException when non-buyer calls dispute', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service } = makeService({ txs: [tx] });

    await expect(service.raiseDispute('tx-1', 'seller-1', 'reason')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException when transaction does not exist', async () => {
    const { service } = makeService({ txs: [] });
    await expect(service.raiseDispute('no-such', 'buyer-1', 'reason')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws UnprocessableEntityException on non-ESCROW_HELD transaction', async () => {
    const tx = makeTx({ status: TransactionStatus.PENDING_PAYMENT });
    const { service } = makeService({ txs: [tx] });

    await expect(service.raiseDispute('tx-1', 'buyer-1', 'reason')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws UnprocessableEntityException when a DisputeRecord already exists', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service, disputeRepo } = makeService({ txs: [tx] });
    disputeRepo.findOne.mockResolvedValue({ id: 'existing-dispute' });

    await expect(service.raiseDispute('tx-1', 'buyer-1', 'reason')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

// ── releaseExpiredEscrows ─────────────────────────────────────────────────────

describe('TransactionsService.releaseExpiredEscrows', () => {
  it('calls gateway.releaseEscrow and transitions ESCROW_HELD → RELEASED_TO_SELLER', async () => {
    const past = new Date(Date.now() - 1000);
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD, releaseAfter: past });
    const { service, txRepo, gateway } = makeService({ txs: [tx] });
    txRepo.find.mockResolvedValue([tx]);

    await service.releaseExpiredEscrows();

    expect(gateway.releaseEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: tx.momoOrderId }),
    );
    expect(tx.status).toBe(TransactionStatus.RELEASED_TO_SELLER);
    expect(tx.releasedAt).toBeInstanceOf(Date);
    expect(txRepo.save).toHaveBeenCalledWith(tx);
  });

  it('skips transactions that have an open dispute', async () => {
    const past = new Date(Date.now() - 1000);
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD, releaseAfter: past });
    const { service, txRepo, disputeRepo, gateway } = makeService({ txs: [tx] });
    txRepo.find.mockResolvedValue([tx]);
    disputeRepo.find.mockResolvedValue([
      { id: 'dispute-1', transactionId: 'tx-1', status: DisputeStatus.OPEN },
    ]);

    await service.releaseExpiredEscrows();

    expect(gateway.releaseEscrow).not.toHaveBeenCalled();
    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('does NOT touch DISPUTED transactions (query filters by ESCROW_HELD)', async () => {
    const { service, txRepo } = makeService({ txs: [] });
    txRepo.find.mockResolvedValue([]);

    await service.releaseExpiredEscrows();

    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('does nothing when no escrows have expired', async () => {
    const { service, txRepo } = makeService({ txs: [] });
    txRepo.find.mockResolvedValue([]);

    await service.releaseExpiredEscrows();

    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('processes multiple expired transactions', async () => {
    const past = new Date(Date.now() - 1000);
    const tx1 = makeTx({ id: 'tx-1', status: TransactionStatus.ESCROW_HELD, releaseAfter: past });
    const tx2 = makeTx({ id: 'tx-2', status: TransactionStatus.ESCROW_HELD, releaseAfter: past });
    const { service, txRepo, gateway } = makeService({ txs: [tx1, tx2] });
    txRepo.find.mockResolvedValue([tx1, tx2]);

    await service.releaseExpiredEscrows();

    expect(gateway.releaseEscrow).toHaveBeenCalledTimes(2);
    expect(txRepo.save).toHaveBeenCalledTimes(2);
    expect(tx1.status).toBe(TransactionStatus.RELEASED_TO_SELLER);
    expect(tx2.status).toBe(TransactionStatus.RELEASED_TO_SELLER);
  });

  it('schedules retry when gateway fails — does not immediately become RELEASE_FAILED', async () => {
    const past = new Date(Date.now() - 1000);
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD, releaseAfter: past });
    const { service, txRepo } = makeService({
      txs: [tx],
      gatewayOverrides: {
        releaseEscrow: jest.fn().mockRejectedValue(new Error('network error')),
      },
    });
    txRepo.find.mockResolvedValue([tx]);

    await service.releaseExpiredEscrows();

    expect(tx.status).toBe(TransactionStatus.ESCROW_HELD);
    expect(tx.releaseAttempts).toBe(1);
    expect(tx.nextReleaseAttemptAt).toBeInstanceOf(Date);
  });
});

// ── processScheduledReleaseRetries ────────────────────────────────────────────

describe('TransactionsService.processScheduledReleaseRetries', () => {
  it('retries and transitions to RELEASED_TO_SELLER on success', async () => {
    const soon = new Date(Date.now() - 100);
    const tx = makeTx({
      status: TransactionStatus.ESCROW_HELD,
      releaseAttempts: 1,
      nextReleaseAttemptAt: soon,
    });
    const { service, txRepo, gateway } = makeService({ txs: [tx] });
    txRepo.find.mockResolvedValue([tx]);

    await service.processScheduledReleaseRetries();

    expect(gateway.releaseEscrow).toHaveBeenCalled();
    expect(tx.status).toBe(TransactionStatus.RELEASED_TO_SELLER);
    expect(tx.nextReleaseAttemptAt).toBeNull();
  });

  it('increments releaseAttempts and schedules next retry when gateway fails again', async () => {
    const soon = new Date(Date.now() - 100);
    const tx = makeTx({
      status: TransactionStatus.ESCROW_HELD,
      releaseAttempts: 1,
      nextReleaseAttemptAt: soon,
    });
    const { service, txRepo } = makeService({
      txs: [tx],
      gatewayOverrides: {
        releaseEscrow: jest.fn().mockRejectedValue(new Error('still failing')),
      },
    });
    txRepo.find.mockResolvedValue([tx]);

    await service.processScheduledReleaseRetries();

    expect(tx.status).toBe(TransactionStatus.ESCROW_HELD);
    expect(tx.releaseAttempts).toBe(2);
    expect(tx.nextReleaseAttemptAt).toBeInstanceOf(Date);
  });

  it('transitions to RELEASE_FAILED when retry count exceeds max', async () => {
    const soon = new Date(Date.now() - 100);
    const tx = makeTx({
      status: TransactionStatus.ESCROW_HELD,
      releaseAttempts: 3,
      nextReleaseAttemptAt: soon,
    });
    const { service, txRepo } = makeService({
      txs: [tx],
      gatewayOverrides: {
        releaseEscrow: jest.fn().mockRejectedValue(new Error('permanent')),
      },
    });
    txRepo.find.mockResolvedValue([tx]);

    await service.processScheduledReleaseRetries();

    expect(tx.status).toBe(TransactionStatus.RELEASE_FAILED);
    expect(tx.nextReleaseAttemptAt).toBeNull();
  });

  it('does nothing when no retries are pending', async () => {
    const { service, txRepo, gateway } = makeService({ txs: [] });
    txRepo.find.mockResolvedValue([]);

    await service.processScheduledReleaseRetries();

    expect(gateway.releaseEscrow).not.toHaveBeenCalled();
  });
});

// ── adminRetryRelease ─────────────────────────────────────────────────────────

describe('TransactionsService.adminRetryRelease', () => {
  it('resets RELEASE_FAILED → ESCROW_HELD and triggers gateway release', async () => {
    const tx = makeTx({ status: TransactionStatus.RELEASE_FAILED, releaseAttempts: 4 });
    const listing = makeListing({ status: ListingStatus.INACTIVE });
    const { service, gateway } = makeService({ txs: [tx], listings: [listing] });

    const result = await service.adminRetryRelease('tx-1');

    expect(gateway.releaseEscrow).toHaveBeenCalled();
    expect(result.status).toBe(TransactionStatus.RELEASED_TO_SELLER);
    expect(result.releaseAttempts).toBe(0);
  });

  it('schedules retry when gateway fails during admin retry', async () => {
    const tx = makeTx({ status: TransactionStatus.RELEASE_FAILED, releaseAttempts: 4 });
    const { service } = makeService({
      txs: [tx],
      gatewayOverrides: {
        releaseEscrow: jest.fn().mockRejectedValue(new Error('still down')),
      },
    });

    const result = await service.adminRetryRelease('tx-1');

    // reset happened (attempts=0), then failed → attempts=1, status=ESCROW_HELD
    expect(result.status).toBe(TransactionStatus.ESCROW_HELD);
    expect(result.releaseAttempts).toBe(1);
  });

  it('throws NotFoundException when transaction does not exist', async () => {
    const { service } = makeService({ txs: [] });
    await expect(service.adminRetryRelease('no-such')).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException when tx is not RELEASE_FAILED', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service } = makeService({ txs: [tx] });
    await expect(service.adminRetryRelease('tx-1')).rejects.toThrow(UnprocessableEntityException);
  });
});

// ── listAdminTransactions ─────────────────────────────────────────────────────

describe('TransactionsService.listAdminTransactions', () => {
  it('queries by status when status is provided', async () => {
    const tx = makeTx({ status: TransactionStatus.RELEASE_FAILED });
    const { service, txRepo } = makeService({ txs: [tx] });
    txRepo.find.mockResolvedValue([tx]);

    const result = await service.listAdminTransactions(TransactionStatus.RELEASE_FAILED);

    expect(txRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: TransactionStatus.RELEASE_FAILED } }),
    );
    expect(result).toEqual([tx]);
  });

  it('queries with empty filter when no status is provided', async () => {
    const { service, txRepo } = makeService({ txs: [] });
    txRepo.find.mockResolvedValue([]);

    await service.listAdminTransactions();

    expect(txRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

// ── resolveDispute ────────────────────────────────────────────────────────────

function makeDispute(overrides: Partial<DisputeRecord> = {}): DisputeRecord {
  return {
    id: 'dispute-1',
    transactionId: 'tx-1',
    raisedByUserId: 'buyer-1',
    reason: 'item not as described',
    evidence: null,
    status: DisputeStatus.OPEN,
    resolvedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as DisputeRecord;
}

describe('TransactionsService.resolveDispute', () => {
  it('BUYER_REFUNDED: calls refundBuyer, transitions DISPUTED→BUYER_REFUNDED, resolves DisputeRecord', async () => {
    const tx = makeTx({ status: TransactionStatus.DISPUTED, momoTransId: '9999' });
    const dispute = makeDispute();
    const { service, txRepo, disputeRepo, gateway } = makeService({ txs: [tx] });
    disputeRepo.findOne.mockResolvedValue(dispute);

    const result = await service.resolveDispute('tx-1', 'BUYER_REFUNDED');

    expect(gateway.refundBuyer).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: tx.momoOrderId, amount: Number(tx.amountVND), transId: '9999' }),
    );
    expect(result.status).toBe(TransactionStatus.BUYER_REFUNDED);
    expect(result.releasedAt).toBeInstanceOf(Date);
    expect(txRepo.save).toHaveBeenCalled();
    expect(dispute.status).toBe(DisputeStatus.RESOLVED_BUYER);
    expect(dispute.resolvedAt).toBeInstanceOf(Date);
    expect(disputeRepo.save).toHaveBeenCalledWith(dispute);
  });

  it('SELLER_RELEASED: calls releaseEscrow, transitions DISPUTED→RELEASED_TO_SELLER, resolves DisputeRecord', async () => {
    const tx = makeTx({ status: TransactionStatus.DISPUTED });
    const listing = makeListing({ status: ListingStatus.INACTIVE });
    const dispute = makeDispute();
    const { service, txRepo, disputeRepo, gateway } = makeService({ txs: [tx], listings: [listing] });
    disputeRepo.findOne.mockResolvedValue(dispute);

    const result = await service.resolveDispute('tx-1', 'SELLER_RELEASED');

    expect(gateway.releaseEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: tx.momoOrderId, amount: Number(tx.amountVND) }),
    );
    expect(result.status).toBe(TransactionStatus.RELEASED_TO_SELLER);
    expect(result.releasedAt).toBeInstanceOf(Date);
    expect(txRepo.save).toHaveBeenCalled();
    expect(dispute.status).toBe(DisputeStatus.RESOLVED_SELLER);
    expect(dispute.resolvedAt).toBeInstanceOf(Date);
    expect(disputeRepo.save).toHaveBeenCalledWith(dispute);
  });

  it('SELLER_RELEASED: marks listing as SOLD', async () => {
    const tx = makeTx({ status: TransactionStatus.DISPUTED });
    const listing = makeListing({ status: ListingStatus.INACTIVE });
    const { service, listingRepo, disputeRepo } = makeService({ txs: [tx], listings: [listing] });
    disputeRepo.findOne.mockResolvedValue(makeDispute());

    await service.resolveDispute('tx-1', 'SELLER_RELEASED');

    const savedListing = listingRepo.save.mock.calls[0]?.[0];
    expect(savedListing?.status).toBe(ListingStatus.SOLD);
  });

  it('BUYER_REFUNDED: unlocks listing to ACTIVE', async () => {
    const tx = makeTx({ status: TransactionStatus.DISPUTED, momoTransId: '9999' });
    const listing = makeListing({ status: ListingStatus.INACTIVE });
    const { service, listingRepo, disputeRepo } = makeService({ txs: [tx], listings: [listing] });
    disputeRepo.findOne.mockResolvedValue(makeDispute());

    await service.resolveDispute('tx-1', 'BUYER_REFUNDED');

    const savedListing = listingRepo.save.mock.calls[0]?.[0];
    expect(savedListing?.status).toBe(ListingStatus.ACTIVE);
  });

  it('throws NotFoundException when transaction does not exist', async () => {
    const { service } = makeService({ txs: [] });
    await expect(service.resolveDispute('no-such', 'BUYER_REFUNDED')).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException when transaction is not DISPUTED', async () => {
    const tx = makeTx({ status: TransactionStatus.ESCROW_HELD });
    const { service } = makeService({ txs: [tx] });
    await expect(service.resolveDispute('tx-1', 'BUYER_REFUNDED')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws NotFoundException when DisputeRecord is missing', async () => {
    const tx = makeTx({ status: TransactionStatus.DISPUTED });
    const { service } = makeService({ txs: [tx] });
    // disputeRepo.findOne returns null by default in makeService
    await expect(service.resolveDispute('tx-1', 'BUYER_REFUNDED')).rejects.toThrow(NotFoundException);
  });

  it('throws InternalServerErrorException when refundBuyer gateway call fails', async () => {
    const tx = makeTx({ status: TransactionStatus.DISPUTED, momoTransId: '9999' });
    const { service, disputeRepo } = makeService({
      txs: [tx],
      gatewayOverrides: {
        refundBuyer: jest.fn().mockRejectedValue(new Error('MoMo timeout')),
      },
    });
    disputeRepo.findOne.mockResolvedValue(makeDispute());

    await expect(service.resolveDispute('tx-1', 'BUYER_REFUNDED')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws InternalServerErrorException when releaseEscrow gateway call fails', async () => {
    const tx = makeTx({ status: TransactionStatus.DISPUTED });
    const { service, disputeRepo } = makeService({
      txs: [tx],
      gatewayOverrides: {
        releaseEscrow: jest.fn().mockRejectedValue(new Error('MoMo timeout')),
      },
    });
    disputeRepo.findOne.mockResolvedValue(makeDispute());

    await expect(service.resolveDispute('tx-1', 'SELLER_RELEASED')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('does NOT save transaction when gateway call fails', async () => {
    const tx = makeTx({ status: TransactionStatus.DISPUTED, momoTransId: '9999' });
    const { service, txRepo, disputeRepo } = makeService({
      txs: [tx],
      gatewayOverrides: {
        refundBuyer: jest.fn().mockRejectedValue(new Error('network error')),
      },
    });
    disputeRepo.findOne.mockResolvedValue(makeDispute());

    await expect(service.resolveDispute('tx-1', 'BUYER_REFUNDED')).rejects.toThrow();
    expect(txRepo.save).not.toHaveBeenCalled();
  });
});
