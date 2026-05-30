import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ERD Summary
 * ===========
 * users ──< marketplace_listings (seller)
 * items ──< marketplace_listings
 * marketplace_listings ──< marketplace_transactions
 * marketplace_listings ──< marketplace_chat_threads
 * users ──< marketplace_transactions (buyer, seller)
 * users ──< marketplace_chat_threads (buyer, seller)
 * marketplace_chat_threads ──< marketplace_chat_messages
 * users ──< marketplace_chat_messages (sender)
 * marketplace_transactions ──< marketplace_reviews
 * users ──< marketplace_reviews (reviewer, reviewee)
 *
 * Cardinalities:
 *   One item       → many listings (re-list after expiry/cancel)
 *   One listing    → many transactions (auctions; buy-now = 1 completed)
 *   One listing    → one chat thread per buyer (unique idx listingId+buyerId)
 *   One thread     → many messages
 *   One transaction→ up to 2 reviews (buyer rates seller, seller rates buyer)
 */
export class CreateMarketplaceTables1780012800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE marketplace_listing_type AS ENUM ('sell', 'rent', 'auction');
      CREATE TYPE marketplace_listing_status AS ENUM ('draft', 'active', 'paused', 'sold', 'expired', 'cancelled');
      CREATE TYPE marketplace_listing_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
      CREATE TYPE marketplace_transaction_status AS ENUM ('pending', 'escrow', 'completed', 'refunded');
    `);

    // ── marketplace_listings ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE marketplace_listings (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "itemId"      UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        "sellerId"    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        price         NUMERIC(12,2) NOT NULL,
        condition     marketplace_listing_condition NOT NULL DEFAULT 'good',
        "listingType" marketplace_listing_type NOT NULL DEFAULT 'sell',
        status        marketplace_listing_status NOT NULL DEFAULT 'draft',
        photos        JSONB NOT NULL DEFAULT '[]',
        description   TEXT,
        location      VARCHAR,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_marketplace_listings_seller ON marketplace_listings("sellerId");
      CREATE INDEX idx_marketplace_listings_item   ON marketplace_listings("itemId");
      CREATE INDEX idx_marketplace_listings_status ON marketplace_listings(status);
    `);

    // ── marketplace_transactions ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE marketplace_transactions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId"     UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        "buyerId"       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "sellerId"      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount          NUMERIC(12,2) NOT NULL,
        status          marketplace_transaction_status NOT NULL DEFAULT 'pending',
        "paymentMethod" VARCHAR,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_marketplace_txn_listing ON marketplace_transactions("listingId");
      CREATE INDEX idx_marketplace_txn_buyer   ON marketplace_transactions("buyerId");
      CREATE INDEX idx_marketplace_txn_seller  ON marketplace_transactions("sellerId");
    `);

    // ── marketplace_chat_threads ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE marketplace_chat_threads (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId" UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        "buyerId"   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "sellerId"  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_chat_thread_listing_buyer UNIQUE ("listingId", "buyerId")
      );
      CREATE INDEX idx_marketplace_thread_buyer  ON marketplace_chat_threads("buyerId");
      CREATE INDEX idx_marketplace_thread_seller ON marketplace_chat_threads("sellerId");
    `);

    // ── marketplace_chat_messages ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE marketplace_chat_messages (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "threadId"  UUID NOT NULL REFERENCES marketplace_chat_threads(id) ON DELETE CASCADE,
        "senderId"  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body        TEXT NOT NULL,
        "isRead"    BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_marketplace_msg_thread ON marketplace_chat_messages("threadId");
      CREATE INDEX idx_marketplace_msg_sender ON marketplace_chat_messages("senderId");
    `);

    // ── marketplace_reviews ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE marketplace_reviews (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "transactionId" UUID NOT NULL REFERENCES marketplace_transactions(id) ON DELETE CASCADE,
        "reviewerId"    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "revieweeId"    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating          SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment         TEXT,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_marketplace_review_txn      ON marketplace_reviews("transactionId");
      CREATE INDEX idx_marketplace_review_reviewee ON marketplace_reviews("revieweeId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_reviews`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_chat_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_chat_threads`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_listings`);
    await queryRunner.query(`
      DROP TYPE IF EXISTS marketplace_transaction_status;
      DROP TYPE IF EXISTS marketplace_listing_condition;
      DROP TYPE IF EXISTS marketplace_listing_status;
      DROP TYPE IF EXISTS marketplace_listing_type;
    `);
  }
}
