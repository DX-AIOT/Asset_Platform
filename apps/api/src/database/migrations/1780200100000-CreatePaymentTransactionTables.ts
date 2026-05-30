import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the payment_transactions and dispute_records tables for the
 * escrow-based payment FSM (DXS-159).
 *
 * ERD Summary
 * ===========
 * marketplace_listings ──< payment_transactions (listing)
 * users                ──< payment_transactions (buyer, seller)
 * payment_transactions ──< dispute_records
 * users                ──< dispute_records (raisedByUser)
 *
 * FSM states: PENDING_PAYMENT → ESCROW_HELD | PAYMENT_FAILED
 *             ESCROW_HELD → RELEASED_TO_SELLER | BUYER_REFUNDED | RELEASE_FAILED | DISPUTED
 *             DISPUTED → RELEASED_TO_SELLER | BUYER_REFUNDED
 */
export class CreatePaymentTransactionTables1780200100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE payment_transaction_status AS ENUM (
        'pending_payment',
        'escrow_held',
        'released_to_seller',
        'buyer_refunded',
        'payment_failed',
        'release_failed',
        'disputed'
      );
      CREATE TYPE dispute_record_status AS ENUM (
        'open',
        'resolved_buyer',
        'resolved_seller'
      );
    `);

    // ── payment_transactions ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE payment_transactions (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId"     UUID          NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        "buyerId"       UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "sellerId"      UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "momoOrderId"   VARCHAR       UNIQUE,
        status          payment_transaction_status NOT NULL DEFAULT 'pending_payment',
        "amountVND"     BIGINT        NOT NULL,
        "escrowHeldAt"  TIMESTAMPTZ,
        "releasedAt"    TIMESTAMPTZ,
        "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_ptxn_listing ON payment_transactions("listingId");
      CREATE INDEX idx_ptxn_buyer   ON payment_transactions("buyerId");
      CREATE INDEX idx_ptxn_seller  ON payment_transactions("sellerId");
      CREATE INDEX idx_ptxn_status  ON payment_transactions(status);
    `);

    // ── dispute_records ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE dispute_records (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "transactionId"   UUID        NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
        "raisedByUserId"  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        reason            TEXT        NOT NULL,
        evidence          JSONB,
        status            dispute_record_status NOT NULL DEFAULT 'open',
        "resolvedAt"      TIMESTAMPTZ,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_dispute_transaction ON dispute_records("transactionId");
      CREATE INDEX idx_dispute_raised_by   ON dispute_records("raisedByUserId");
      CREATE INDEX idx_dispute_status      ON dispute_records(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dispute_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS payment_transactions`);
    await queryRunner.query(`
      DROP TYPE IF EXISTS dispute_record_status;
      DROP TYPE IF EXISTS payment_transaction_status;
    `);
  }
}
