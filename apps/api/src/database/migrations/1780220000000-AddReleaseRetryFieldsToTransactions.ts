import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReleaseRetryFieldsToTransactions1780220000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_transactions
        ADD COLUMN IF NOT EXISTS "releaseAttempts"     INTEGER     NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "nextReleaseAttemptAt" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_transactions
        DROP COLUMN IF EXISTS "nextReleaseAttemptAt",
        DROP COLUMN IF EXISTS "releaseAttempts"
    `);
  }
}
