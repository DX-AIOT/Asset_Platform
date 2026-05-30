# Backend API — DX Solutions Asset Platform

NestJS REST API for the AIoT Asset Platform. Runs on port `3001` by default.

## How to run locally

### Prerequisites

- Node.js ≥ 18, npm ≥ 9
- Docker + Docker Compose (for Postgres + Redis)

### Start dependencies

```bash
# From the repo root
docker compose up -d postgres redis
```

### Configure environment

Copy the root `.env` example and fill in your values:

```env
# Database
DATABASE_URL=postgresql://asset_user:asset_pass_dev@localhost:5432/asset_platform

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=change_me_in_production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=change_me_too
REFRESH_TOKEN_EXPIRES_IN=30d

# AI — set OPENAI_LOCAL_MODE=true to skip real API calls during local dev
OPENAI_API_KEY=sk-...
OPENAI_LOCAL_MODE=true

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Email (Nodemailer)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=noreply@example.com

# Firebase push notifications (optional)
FIREBASE_SERVICE_ACCOUNT_JSON=

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Node env
NODE_ENV=development
API_PORT=3001
```

### Start the API

```bash
# From the repo root (turborepo)
npm run dev

# Or directly from apps/api
cd apps/api
npm run dev
```

The API serves at `http://localhost:3001/api`.
Interactive Swagger docs are at `http://localhost:3001/api/docs`.

### Seed demo data (optional)

```bash
cd apps/api
npm run seed:demo
```

### Run tests

```bash
cd apps/api
npm test           # unit + integration
npm run test:cov   # with coverage
```

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | Access token signing secret |
| `JWT_EXPIRES_IN` | No | `7d` | Access token TTL |
| `REFRESH_TOKEN_SECRET` | Yes | — | Refresh token signing secret |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `30d` | Refresh token TTL |
| `OPENAI_API_KEY` | No* | — | Required in production for AI features |
| `OPENAI_LOCAL_MODE` | No | `false` | Set `true` to return AI stubs locally |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth2 client secret |
| `GOOGLE_CALLBACK_URL` | No | — | OAuth redirect URI |
| `SMTP_*` / `MAIL_FROM` | No | — | Nodemailer config for invite emails |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No | — | Firebase Admin JSON for push notifications |
| `ALLOWED_ORIGINS` | No | `*` (dev) | Comma-separated CORS origins in production |
| `NODE_ENV` | No | `development` | Set `production` for secure cookies |
| `API_PORT` | No | `3001` | HTTP listen port |

---

## Architecture decisions

### NestJS modules

The API is organised into six feature modules, each self-contained with controller → service → repository:

| Module | Routes | Notes |
|---|---|---|
| `AuthModule` | `/api/auth/*` | JWT, Google OAuth, CSRF, password management |
| `ItemsModule` | `/api/items/*` | Asset CRUD, depreciation, portfolio totals |
| `AiModule` | `/api/ai/*` | Vision recognition, OCR, barcode, valuation, condition assessment |
| `ReportsModule` | `/api/reports/*` | Insurance PDF generation (PDFKit) |
| `SharingModule` | `/api/sharing/*` | Family / multi-user inventory sharing |
| `RemindersModule` | `/api/assets/:id/reminders`, `/api/reminders/*` | Maintenance reminders + Firebase push |

### Authentication — dual-path JWT

All protected routes are guarded by `JwtAuthGuard`, which extends Passport's `AuthGuard('jwt')`.

- **Web clients** attach the access token via an httpOnly `access_token` cookie (set by the JWT Passport strategy's cookie extractor).
- **Mobile / API clients** send `Authorization: Bearer <token>`.

The `@Public()` decorator bypasses the guard for open endpoints (register, login, OAuth, invite-accept).

**CSRF protection** — the server writes a non-httpOnly `csrf-token` cookie on every auth operation. The frontend reads it via JavaScript and sends it back as the `x-csrf-token` header. The `CsrfGuard` validates the header against the cookie on all mutating requests from web clients.

**Token rotation** — refresh tokens are bcrypt-hashed before storage. On each refresh, the stored hash is replaced with the new token's hash, making each refresh token single-use.

### AI integration

AI endpoints under `/api/ai/*` call OpenAI's Vision and Chat Completion APIs:

- `POST /ai/recognize` — asset identification from an image
- `POST /ai/ocr-receipt` — purchase data extraction from a receipt image
- `POST /ai/condition-assessment` — condition scoring (new → poor) from an image
- `POST /ai/valuation` — market-value estimate with Redis caching (24 h TTL)
- `POST /ai/barcode-lookup` — product lookup from a barcode, no external API needed
- `POST /ai/auto-category-duplicate` — category classification + duplicate detection

Set `OPENAI_LOCAL_MODE=true` to skip real API calls; all AI services return deterministic stubs so the app is fully functional without a key.

### Depreciation calculation

`ItemsService.getDepreciation` uses the **declining-balance** formula:

```
value(year) = purchasePrice × (1 − rate/100)^yearsElapsed
```

The annual rate comes from `item.depreciationRatePercent` if set, otherwise falls back to category defaults (Electronics/Mobile/Laptops: 20%, Vehicles: 15%, Appliances: 12%, Furniture/Other: 10%).

### Insurance PDF generation

`ReportsService.generateInsurancePdf` uses PDFKit in buffered-page mode to produce an A4 document with:

1. **Cover page** — owner info, summary statistics
2. **One asset page** per item — brand/model, serial, purchase and current value
3. **Summary table** — all assets in a paginated table with totals

Pages are buffered before flushing so a "Page N of M" footer can be stamped in a second pass.

### Maintenance reminders scheduled job

`MaintenanceJobService.sendDueReminders` runs every day at 08:00 via `@nestjs/schedule`. It:

1. Queries reminders due within 3 days
2. Persists an in-app `Notification` record for each
3. Sends a Firebase Cloud Messaging push notification when the user has registered an FCM token (`PUT /api/reminders/device-token`)

### Redis caching

Market valuations (`/api/ai/valuation`) are cached in Redis with a 24-hour TTL using a key derived from `name+category+condition+purchaseYear`. The cache is populated on the first miss and served on subsequent identical requests.
