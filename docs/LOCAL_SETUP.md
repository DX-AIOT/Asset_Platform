# Local Setup and Validation

This document defines the current local-first verification path for the Asset Platform.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Engine running
- Docker Compose support:
  - `docker compose` (v2 plugin), or
  - `docker-compose` (legacy binary)

## Environment

1. Copy template and fill values:
   - `cp .env.template .env`
2. Keep local defaults for:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `NEXT_PUBLIC_API_URL`
   - `EXPO_PUBLIC_API_URL`

## Static local-first gate

Run:

```bash
npm run qa:local-first-gate
```

Expected:
- Compose file contains local services (`postgres`, `redis`, `api`)
- No hard dependency on cloud credentials/endpoints

## Full local stack bring-up

Run:

```bash
docker compose down -v
docker compose up -d --build
docker compose ps
```

If your machine uses legacy CLI:

```bash
docker-compose down -v
docker-compose up -d --build
docker-compose ps
```

## Health checks

API uses global `/api` prefix, so health endpoint is:

```bash
curl -fsS http://localhost:3001/api/health
```

## Current CI fallback (GitHub Actions)

Workflow: `.github/workflows/local-first-gate.yml`

It currently validates:
- static local-first gate
- docker stack boot in CI runner
- API health at `http://localhost:3001/api/health`

## Coverage gaps vs DXS-88 full E2E scope

Not yet covered by the current CI workflow:
- web app dev/start verification (`apps/web`)
- manual user flow (register/login/add item/dashboard/export CSV/insurance report)
- AI flow (vision/OCR/market valuation endpoints)
- cookie-based auth regression checks

Use CI workflow as an environment-compatible gate for local stack boot + API readiness, not as full replacement for complete DXS-88 E2E coverage.
