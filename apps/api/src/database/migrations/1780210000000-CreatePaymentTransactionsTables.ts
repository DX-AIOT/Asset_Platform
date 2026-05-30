import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTransactionsTables1780210000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE payment_transaction_status AS ENUM (
        'pending_payment',
        'escrow_held',
        'released_to_seller',
        'buyer_refunded',
        'payment_failed',
        'release_failed',
        'disputed'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE payment_transactions (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId"       UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        "buyerId"         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "sellerId"        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "momoOrderId"     VARCHAR UNIQUE,
        "momoRequestId"   VARCHAR UNIQUE,
        "momoPaymentUrl"  TEXT,
        "momoTransId"     VARCHAR,
        status            payment_transaction_status NOT NULL DEFAULT 'pending_payment',
        "amountVND"       BIGINT NOT NULL,
        "escrowHeldAt"    TIMESTAMPTZ,
        "releasedAt"      TIMESTAMPTZ,
        "releaseAfter"    TIMESTAMPTZ,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE dispute_status AS ENUM (
        'open',
        'resolved_buyer',
        'resolved_seller'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE dispute_records (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "transactionId"     UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
        "raisedByUserId"    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        reason              TEXT NOT NULL,
        evidence            JSONB,
        status              dispute_status NOT NULL DEFAULT 'open',
        "resolvedAt"        TIMESTAMPTZ,
        "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dispute_records`);
    await queryRunner.query(`DROP TYPE IF EXISTS dispute_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS payment_transactions`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_transaction_status`);
  }
}
