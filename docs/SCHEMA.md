# Database Schema

## Core Tables (Phase 1–2)

| Table | Description |
|-------|-------------|
| `users` | Platform accounts (email/Google auth, roles) |
| `items` | User-owned assets (electronics, vehicles, etc.) |
| `family_shares` | Item-sharing grants between users |
| `maintenance_reminders` | Scheduled maintenance alerts per item |
| `maintenance_records` | Completed maintenance log entries |
| `notifications` | Push/in-app notification records |

## Marketplace Tables (Phase 3)

Migration: `1780012800000-CreateMarketplaceTables`

---

### `marketplace_listings`

Represents an item listed for sale, rent, or auction.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `itemId` | UUID FK → items | CASCADE DELETE |
| `sellerId` | UUID FK → users | CASCADE DELETE |
| `price` | NUMERIC(12,2) | Listed price |
| `condition` | enum | `new` \| `like_new` \| `good` \| `fair` \| `poor` |
| `listingType` | enum | `sell` \| `rent` \| `auction` |
| `status` | enum | `draft` \| `active` \| `paused` \| `sold` \| `expired` \| `cancelled` |
| `photos` | JSONB | Array of photo URLs |
| `description` | TEXT nullable | |
| `location` | VARCHAR nullable | |
| `createdAt` | TIMESTAMPTZ | |
| `updatedAt` | TIMESTAMPTZ | |

Indexes: `sellerId`, `itemId`, `status`

---

### `marketplace_transactions`

Records a purchase/rental agreement between buyer and seller.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `listingId` | UUID FK → marketplace_listings | CASCADE DELETE |
| `buyerId` | UUID FK → users | RESTRICT DELETE |
| `sellerId` | UUID FK → users | RESTRICT DELETE |
| `amount` | NUMERIC(12,2) | Agreed final amount |
| `status` | enum | `pending` \| `escrow` \| `completed` \| `refunded` |
| `paymentMethod` | VARCHAR nullable | e.g. `stripe`, `bank_transfer` |
| `createdAt` | TIMESTAMPTZ | |
| `updatedAt` | TIMESTAMPTZ | |

Indexes: `listingId`, `buyerId`, `sellerId`

---

### `marketplace_chat_threads`

One conversation thread per (listing, buyer) pair.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `listingId` | UUID FK → marketplace_listings | CASCADE DELETE |
| `buyerId` | UUID FK → users | CASCADE DELETE |
| `sellerId` | UUID FK → users | CASCADE DELETE |
| `createdAt` | TIMESTAMPTZ | |
| `updatedAt` | TIMESTAMPTZ | |

Unique constraint: `(listingId, buyerId)`

Indexes: `buyerId`, `sellerId`

---

### `marketplace_chat_messages`

Individual messages within a chat thread.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `threadId` | UUID FK → marketplace_chat_threads | CASCADE DELETE |
| `senderId` | UUID FK → users | CASCADE DELETE |
| `body` | TEXT | |
| `isRead` | BOOLEAN | default `false` |
| `createdAt` | TIMESTAMPTZ | |

Indexes: `threadId`, `senderId`

---

### `marketplace_reviews`

Post-transaction rating left by buyer or seller.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `transactionId` | UUID FK → marketplace_transactions | CASCADE DELETE |
| `reviewerId` | UUID FK → users | CASCADE DELETE |
| `revieweeId` | UUID FK → users | CASCADE DELETE |
| `rating` | SMALLINT | 1–5, enforced by CHECK constraint |
| `comment` | TEXT nullable | |
| `createdAt` | TIMESTAMPTZ | |
| `updatedAt` | TIMESTAMPTZ | |

Indexes: `transactionId`, `revieweeId`

---

## Notification Types

The `notifications.type` column is extended for marketplace events:

| Type value | Trigger |
|------------|---------|
| `maintenance_reminder` | Scheduled asset maintenance due (Phase 2) |
| `listing_alert` | A watched listing status changed or a new match appeared |
| `chat_message` | New unread chat message received |
| `transaction_update` | Transaction status changed (escrow, completed, refunded) |

---

## ERD — Relationships

```
users ──────────────────────┐
  │                         │
  │ (seller)                │ (buyer)
  ▼                         ▼
marketplace_listings ───> marketplace_chat_threads ──> marketplace_chat_messages
  │                                                          │
  │                                                     (sender: user)
  ▼
marketplace_transactions ──> marketplace_reviews
  │                              │
  │ (buyer / seller)         (reviewer / reviewee: user)
  ▼
users

items ──────────────────────> marketplace_listings
```

Cardinalities:
- One **item** → many **listings** (re-list after expiry or cancellation)
- One **listing** → many **transactions** (auctions allow multiple bidders; buy-now expects one completed transaction)
- One **listing** → one **chat thread** per unique buyer (unique index enforces this)
- One **thread** → many **messages**
- One **transaction** → up to 2 **reviews** (buyer rates seller, seller rates buyer)
