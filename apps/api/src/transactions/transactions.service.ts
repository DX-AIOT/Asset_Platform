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
import { Repository, LessThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Transaction, TransactionStatus, TRANSACTION_FSM } from './entities/transaction.entity';
import { DisputeRecord } from './entities/dispute-record.entity';
import { Listing, ListingStatus } from '../marketplace/entities/listing.entity';
import {
  IPaymentGateway,
  PAYMENT_GATEWAY,
  IpnPayload,
} from '../payments/interfaces/payment-gateway.interface';

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

    this.transition(tx, TransactionStatus.RELEASED_TO_SELLER);
    tx.releasedAt = new Date();
    await this.txRepo.save(tx);

    const listing = await this.listingRepo.findOne({ where: { id: tx.listingId } });
    if (listing) {
      listing.status = ListingStatus.SOLD;
      await this.listingRepo.save(listing);
    }

    this.logger.log(`confirmReceipt ESCROW_HELD→RELEASED_TO_SELLER txId=${id}`);
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

  async releaseExpiredEscrows(): Promise<void> {
    const expired = await this.txRepo.find({
      where: { status: TransactionStatus.ESCROW_HELD, releaseAfter: LessThanOrEqual(new Date()) },
    });

    for (const tx of expired) {
      tx.status = TransactionStatus.RELEASED_TO_SELLER;
      tx.releasedAt = new Date();
      await this.txRepo.save(tx);
      this.logger.log(`Auto-release ESCROW_HELD→RELEASED_TO_SELLER txId=${tx.id}`);
    }
  }
}
