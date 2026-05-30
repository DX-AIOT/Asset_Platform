import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends marketplace_listings for the CRUD + Browse API (DXS-144):
 *   - Adds 'inactive' and 'deleted' to the status enum
 *   - Adds currency, lat, lng, city, publishedAt, expiresAt columns
 *   - Adds performance indexes for browse/filter queries
 *
 * ALTER TYPE ... ADD VALUE cannot run inside a transaction on PG <12,
 * so this migration disables the transaction wrapper.
 */
export class AddListingColumnsForCRUD1780012900000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE marketplace_listing_status ADD VALUE IF NOT EXISTS 'inactive'`,
    );
    await queryRunner.query(
      `ALTER TYPE marketplace_listing_status ADD VALUE IF NOT EXISTS 'deleted'`,
    );

    await queryRunner.query(`
      ALTER TABLE marketplace_listings
        ADD COLUMN IF NOT EXISTS currency      VARCHAR         NOT NULL DEFAULT 'USD',
        ADD COLUMN IF NOT EXISTS lat           DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS lng           DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS city          VARCHAR,
        ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "expiresAt"   TIMESTAMPTZ;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ml_status_published
        ON marketplace_listings(status, "publishedAt");
      CREATE INDEX IF NOT EXISTS idx_ml_active_expires
        ON marketplace_listings("expiresAt")
        WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_ml_price
        ON marketplace_listings(price);
      CREATE INDEX IF NOT EXISTS idx_ml_condition
        ON marketplace_listings(condition);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ml_condition`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ml_price`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ml_active_expires`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ml_status_published`);
    await queryRunner.query(`
      ALTER TABLE marketplace_listings
        DROP COLUMN IF EXISTS "expiresAt",
        DROP COLUMN IF EXISTS "publishedAt",
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS lng,
        DROP COLUMN IF EXISTS lat,
        DROP COLUMN IF EXISTS currency;
    `);
    // Enum values cannot be removed in PostgreSQL; 'inactive'/'deleted' will remain.
  }
}
