import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Transaction, TransactionStatus, TRANSACTION_FSM } from './entities/transaction.entity';
import { DisputeRecord, DisputeStatus } from './entities/dispute-record.entity';
import { Listing, ListingStatus } from '../marketplace/entities/listing.entity';
import {
  IPaymentGateway,
  PAYMENT_GATEWAY,
  IpnPayload,
} from '../payments/interfaces/payment-gateway.interface';

// Delays (ms) before each retry: attempt 1 → +1 min, attempt 2 → +5 min, attempt 3 → +15 min
const RELEASE_RETRY_DELAYS_MS = [60_000, 300_000, 900_000];

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(DisputeRecord)
    private readonly disputeRepo: Repository<DisputeRecord>,
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: IPaymentGateway,
    private readonly config: ConfigService,
  ) {}

  private transition(tx: Transaction, next: TransactionStatus): void {
    const allowed = TRANSACTION_FSM[tx.status];
    if (!allowed?.includes(next)) {
      throw new UnprocessableEntityException(
        `Cannot transition from ${tx.status} to ${next}`,
      );
    }
    tx.status = next;
  }

  /**
   * Calls MoMo releaseEscrow for `tx`. On success: → RELEASED_TO_SELLER, marks listing SOLD.
   * On failure: increments releaseAttempts and schedules next retry at 1m/5m/15m intervals.
   * After all retries exhausted (> RELEASE_RETRY_DELAYS_MS.length) → RELEASE_FAILED + ops alert.
   */
  private async attemptGatewayRelease(tx: Transaction): Promise<void> {
    try {
      await this.gateway.releaseEscrow({
        orderId: tx.momoOrderId!,
        requestId: `REL-${tx.id.replace(/-/g, '').slice(0, 14)}-${tx.releaseAttempts}`,
        amount: tx.amountVND,
        description: `Release escrow txId=${tx.id}`,
      });

      this.transition(tx, TransactionStatus.RELEASED_TO_SELLER);
      tx.releasedAt = new Date();
      tx.nextReleaseAttemptAt = null;
      await this.txRepo.save(tx);

      const listing = await this.listingRepo.findOne({ where: { id: tx.listingId } });
      if (listing) {
        listing.status = ListingStatus.SOLD;
        await this.listingRepo.save(listing);
      }

      this.logger.log(
        `Gateway release success →RELEASED_TO_SELLER txId=${tx.id} attempt=${tx.releaseAttempts}`,
      );
    } catch (err) {
      tx.releaseAttempts += 1;

      if (tx.releaseAttempts > RELEASE_RETRY_DELAYS_MS.length) {
        this.transition(tx, TransactionStatus.RELEASE_FAILED);
        tx.nextReleaseAttemptAt = null;
        await this.txRepo.save(tx);
        this.logger.error(
          `RELEASE_FAILED after ${tx.releaseAttempts} attempts txId=${tx.id} amountVND=${tx.amountVND} — OPS_ALERT: manual intervention required`,
        );
      } else {
        const delayMs = RELEASE_RETRY_DELAYS_MS[tx.releaseAttempts - 1];
        tx.nextReleaseAttemptAt = new Date(Date.now() + delayMs);
        await this.txRepo.save(tx);
        this.logger.warn(
          `Gateway release failed txId=${tx.id} attempt=${tx.releaseAttempts}/${RELEASE_RETRY_DELAYS_MS.length + 1}, next retry at ${tx.nextReleaseAttemptAt.toISOString()} err=${err}`,
        );
      }
    }
  }

  async initiate(listingId: string, buyerId: string) {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException('Listing not found or not available for purchase');
    }
    if (listing.sellerId === buyerId) {
      throw new UnprocessableEntityException('Buyer cannot purchase their own listing');
    }

    const tx = this.txRepo.create({
      listingId,
      buyerId,
      sellerId: listing.sellerId,
      amountVND: Math.round(Number(listing.price)),
      status: TransactionStatus.PENDING_PAYMENT,
    });
    await this.txRepo.save(tx);

    // Lock listing so concurrent buyers can't purchase the same item
    listing.status = ListingStatus.INACTIVE;
    await this.listingRepo.save(listing);

    const orderId = `DXS-${tx.id.replace(/-/g, '').slice(0, 16)}`;
    const requestId = `REQ-${tx.id.replace(/-/g, '').slice(0, 16)}`;
    const redirectUrl = this.config.getOrThrow<string>('MOMO_REDIRECT_URL');
    const ipnUrl = this.config.getOrThrow<string>('MOMO_IPN_URL');

    let hold: Awaited<ReturnType<IPaymentGateway['initiateEscrowHold']>>;
    try {
      hold = await this.gateway.initiateEscrowHold({
        orderId,
        requestId,
        amount: tx.amountVND,
        orderInfo: `Purchase listing ${listingId}`,
        redirectUrl,
        ipnUrl,
      });
    } catch (err) {
      this.logger.error(`initiateEscrowHold failed txId=${tx.id}: ${err}`);
      tx.status = TransactionStatus.PAYMENT_FAILED;
      await this.txRepo.save(tx);
      listing.status = ListingStatus.ACTIVE;
      await this.listingRepo.save(listing);
      throw new InternalServerErrorException('Payment initiation failed — please try again');
    }

    tx.momoOrderId = orderId;
    tx.momoRequestId = requestId;
    tx.momoPaymentUrl = hold.paymentUrl;
    await this.txRepo.save(tx);

    return { transactionId: tx.id, momoOrderId: orderId, payUrl: hold.paymentUrl, status: tx.status };
  }

  async getTransaction(id: string, userId: string): Promise<Transaction> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== userId && tx.sellerId !== userId) throw new ForbiddenException('Access denied');
    return tx;
  }

  async handleIpn(payload: IpnPayload): Promise<void> {
    if (!this.gateway.verifyIpnSignature(payload)) {
      this.logger.warn(`IPN signature mismatch orderId=${payload.orderId}`);
      return;
    }

    const tx = await this.txRepo.findOne({ where: { momoOrderId: payload.orderId } });
    if (!tx) {
      this.logger.warn(`IPN unknown orderId=${payload.orderId}`);
      return;
    }

    if (tx.status !== TransactionStatus.PENDING_PAYMENT) {
      this.logger.log(`IPN idempotent skip — already ${tx.status}`);
      return;
    }

    if (payload.resultCode === 0) {
      // Verify the paid amount matches what we initiated to prevent underpayment
      if (Number(payload.amount) !== Number(tx.amountVND)) {
        this.logger.error(
          `IPN amount mismatch orderId=${payload.orderId} expected=${tx.amountVND} got=${payload.amount}`,
        );
        this.transition(tx, TransactionStatus.PAYMENT_FAILED);
        await this.txRepo.save(tx);
        await this.unlockListing(tx.listingId);
        return;
      }

      const autoReleaseDays = this.config.get<number>('ESCROW_AUTO_RELEASE_DAYS', 7);
      const autoReleaseMinutes = this.config.get<number>('ESCROW_AUTO_RELEASE_MINUTES');
      const releaseAfter = new Date();
      if (autoReleaseMinutes) {
        releaseAfter.setMinutes(releaseAfter.getMinutes() + autoReleaseMinutes);
      } else {
        releaseAfter.setDate(releaseAfter.getDate() + autoReleaseDays);
      }

      this.transition(tx, TransactionStatus.ESCROW_HELD);
      tx.momoTransId = String(payload.transId);
      tx.escrowHeldAt = new Date();
      tx.releaseAfter = releaseAfter;
      await this.txRepo.save(tx);
      this.logger.log(`IPN success PENDING_PAYMENT→ESCROW_HELD orderId=${payload.orderId}`);
    } else {
      this.transition(tx, TransactionStatus.PAYMENT_FAILED);
      await this.txRepo.save(tx);
      await this.unlockListing(tx.listingId);
      this.logger.log(`IPN failed (${payload.resultCode}) PENDING_PAYMENT→PAYMENT_FAILED`);
    }
  }

  private async unlockListing(listingId: string): Promise<void> {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (listing && listing.status === ListingStatus.INACTIVE) {
      listing.status = ListingStatus.ACTIVE;
      await this.listingRepo.save(listing);
      this.logger.log(`Listing unlocked listingId=${listingId}`);
    }
  }

  async confirmReceipt(id: string, userId: string): Promise<Transaction> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== userId) throw new ForbiddenException('Only the buyer can confirm receipt');
    if (tx.status !== TransactionStatus.ESCROW_HELD) {
      throw new UnprocessableEntityException(
        `Cannot confirm receipt: transaction is ${tx.status}`,
      );
    }

    await this.attemptGatewayRelease(tx);
    this.logger.log(`confirmReceipt buyer=${userId} txId=${id} → ${tx.status}`);
    return tx;
  }

  async raiseDispute(id: string, userId: string, reason: string): Promise<Transaction> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== userId) throw new ForbiddenException('Only the buyer can raise a dispute');

    const existing = await this.disputeRepo.findOne({ where: { transactionId: id } });
    if (existing) throw new UnprocessableEntityException('A dispute already exists for this transaction');

    this.transition(tx, TransactionStatus.DISPUTED);
    await this.txRepo.save(tx);

    const dispute = this.disputeRepo.create({ transactionId: id, raisedByUserId: userId, reason });
    await this.disputeRepo.save(dispute);

    this.logger.log(`raiseDispute ESCROW_HELD→DISPUTED txId=${id}`);
    return tx;
  }

  async resolveDispute(
    id: string,
    resolution: 'BUYER_REFUNDED' | 'SELLER_RELEASED',
  ): Promise<Transaction> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    if (tx.status !== TransactionStatus.DISPUTED) {
      throw new UnprocessableEntityException(
        `Cannot resolve dispute: transaction is in state ${tx.status}`,
      );
    }

    const dispute = await this.disputeRepo.findOne({ where: { transactionId: id } });
    if (!dispute) throw new NotFoundException('Dispute record not found');

    if (!tx.momoOrderId) {
      throw new UnprocessableEntityException('MoMo order ID missing — cannot proceed');
    }

    const resolveRequestId = `RES-${id.replace(/-/g, '').slice(0, 16)}`;

    if (resolution === 'BUYER_REFUNDED') {
      if (!tx.momoTransId) {
        throw new UnprocessableEntityException('MoMo transaction ID missing — cannot refund');
      }
      try {
        await this.gateway.refundBuyer({
          orderId: tx.momoOrderId,
          requestId: resolveRequestId,
          amount: Number(tx.amountVND),
          transId: tx.momoTransId,
          description: `Dispute resolved in buyer favour txId=${id}`,
        });
      } catch (err) {
        this.logger.error(`refundBuyer failed txId=${id}: ${err}`);
        throw new InternalServerErrorException('MoMo refund failed — ops must retry manually');
      }

      this.transition(tx, TransactionStatus.BUYER_REFUNDED);
      tx.releasedAt = new Date();
      dispute.status = DisputeStatus.RESOLVED_BUYER;

      await this.unlockListing(tx.listingId);
    } else {
      try {
        await this.gateway.releaseEscrow({
          orderId: tx.momoOrderId,
          requestId: resolveRequestId,
          amount: Number(tx.amountVND),
          description: `Dispute resolved in seller favour txId=${id}`,
        });
      } catch (err) {
        this.logger.error(`releaseEscrow failed txId=${id}: ${err}`);
        throw new InternalServerErrorException('MoMo release failed — ops must retry manually');
      }

      this.transition(tx, TransactionStatus.RELEASED_TO_SELLER);
      tx.releasedAt = new Date();
      dispute.status = DisputeStatus.RESOLVED_SELLER;

      const listing = await this.listingRepo.findOne({ where: { id: tx.listingId } });
      if (listing) {
        listing.status = ListingStatus.SOLD;
        await this.listingRepo.save(listing);
      }
    }

    dispute.resolvedAt = new Date();
    await this.txRepo.save(tx);
    await this.disputeRepo.save(dispute);

    this.logger.log(
      `resolveDispute DISPUTED→${tx.status} resolution=${resolution} txId=${id} buyerId=${tx.buyerId} sellerId=${tx.sellerId}`,
    );

    return tx;
  }

  /**
   * Auto-release cron target: release all ESCROW_HELD transactions whose releaseAfter has passed
   * and which have no open dispute and are not already in a retry cycle. Idempotent.
   */
  async releaseExpiredEscrows(): Promise<void> {
    const expired = await this.txRepo.find({
      where: {
        status: TransactionStatus.ESCROW_HELD,
        releaseAfter: LessThanOrEqual(new Date()),
        nextReleaseAttemptAt: IsNull(),
      },
    });

    if (expired.length === 0) return;

    // Exclude transactions with open disputes
    const txIds = expired.map((t) => t.id);
    const openDisputes = await this.disputeRepo.find({
      where: { transactionId: In(txIds), status: DisputeStatus.OPEN },
    });
    const disputedIds = new Set(openDisputes.map((d) => d.transactionId));
    const toRelease = expired.filter((t) => !disputedIds.has(t.id));

    for (const tx of toRelease) {
      this.logger.log(`Auto-release triggering gateway release txId=${tx.id}`);
      await this.attemptGatewayRelease(tx);
    }
  }

  /**
   * Retry cron target: process scheduled release retries for failed ESCROW_HELD transactions.
   */
  async processScheduledReleaseRetries(): Promise<void> {
    const pending = await this.txRepo.find({
      where: {
        status: TransactionStatus.ESCROW_HELD,
        nextReleaseAttemptAt: LessThanOrEqual(new Date()),
      },
    });

    for (const tx of pending) {
      this.logger.log(
        `Processing scheduled retry attempt=${tx.releaseAttempts} txId=${tx.id}`,
      );
      await this.attemptGatewayRelease(tx);
    }
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  async listAdminTransactions(status?: TransactionStatus): Promise<Transaction[]> {
    const where = status ? { status } : {};
    return this.txRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  async adminRetryRelease(id: string): Promise<Transaction> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.status !== TransactionStatus.RELEASE_FAILED) {
      throw new UnprocessableEntityException('Transaction is not in RELEASE_FAILED state');
    }

    // Reset to ESCROW_HELD so the normal release flow can proceed
    this.transition(tx, TransactionStatus.ESCROW_HELD);
    tx.releaseAttempts = 0;
    tx.nextReleaseAttemptAt = null;
    await this.txRepo.save(tx);

    await this.attemptGatewayRelease(tx);
    this.logger.log(`Admin retry release txId=${id} → ${tx.status}`);
    return tx;
  }
}
