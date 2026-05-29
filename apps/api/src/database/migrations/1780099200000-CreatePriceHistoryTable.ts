import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Price History Tracking (DXS-97).
 *
 * items ──< price_history   (one item → many value snapshots, newest wins)
 *
 * Append-only series; trend (% change over 30/90/365d) is computed at read
 * time. Indexed on ("itemId", "recordedAt") to make the per-item ordered
 * range scan O(log n + k).
 */
export class CreatePriceHistoryTable1780099200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE price_history_source AS ENUM ('manual', 'ai', 'market');
    `);

    await queryRunner.query(`
      CREATE TABLE price_history (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "itemId"        UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        "estimatedValue" NUMERIC(12,2) NOT NULL,
        currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
        source          price_history_source NOT NULL DEFAULT 'ai',
        "recordedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_price_history_item_recorded
        ON price_history("itemId", "recordedAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS price_history;`);
    await queryRunner.query(`DROP TYPE IF EXISTS price_history_source;`);
  }
}
