import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends marketplace_transactions for MoMo payment integration (DXS-165):
 *   - Adds 'disputed' to marketplace_transaction_status enum
 *   - Adds MoMo tracking columns: momoOrderId, momoRequestId, momoPaymentUrl, momoTransId
 *   - Adds escrow/dispute timestamp columns: escrowHeldAt, escrowReleasedAt,
 *     disputeRaisedAt, releaseAfter
 *
 * ALTER TYPE ... ADD VALUE cannot run inside a transaction on PG <12,
 * so this migration disables the transaction wrapper.
 */
export class AddMoMoFieldsToTransactions1780200000000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE marketplace_transaction_status ADD VALUE IF NOT EXISTS 'disputed'`,
    );

    await queryRunner.query(`
      ALTER TABLE marketplace_transactions
        ADD COLUMN IF NOT EXISTS "momoOrderId"      VARCHAR         UNIQUE,
        ADD COLUMN IF NOT EXISTS "momoRequestId"    VARCHAR         UNIQUE,
        ADD COLUMN IF NOT EXISTS "momoPaymentUrl"   TEXT,
        ADD COLUMN IF NOT EXISTS "momoTransId"      VARCHAR,
        ADD COLUMN IF NOT EXISTS "escrowHeldAt"     TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "escrowReleasedAt" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "disputeRaisedAt"  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "releaseAfter"     TIMESTAMPTZ;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_transactions
        DROP COLUMN IF EXISTS "releaseAfter",
        DROP COLUMN IF EXISTS "disputeRaisedAt",
        DROP COLUMN IF EXISTS "escrowReleasedAt",
        DROP COLUMN IF EXISTS "escrowHeldAt",
        DROP COLUMN IF EXISTS "momoTransId",
        DROP COLUMN IF EXISTS "momoPaymentUrl",
        DROP COLUMN IF EXISTS "momoRequestId",
        DROP COLUMN IF EXISTS "momoOrderId";
    `);
    // 'disputed' enum value cannot be removed in PostgreSQL; it will remain in
    // marketplace_transaction_status but no code path will produce it after rollback.
  }
}
