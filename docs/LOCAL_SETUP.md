# Local Development Setup

Last verified: 2026-05-30 (DXS-88 full E2E pass — all 13 checks green).

## Prerequisites

- Docker Engine ≥ 29.x + Docker Compose v2 (plugin: `docker compose version`)
- Node.js 20 (for web app dev only)
- npm 10+

## 1. Start the stack

```bash
docker compose down -v          # clean slate (removes DB volumes)
docker compose up -d --build    # build API image + start all services
```

Services:
| Service   | Internal port | Host port |
|-----------|--------------|-----------|
| API        | 3001         | 3002      |
| PostgreSQL | 5432         | 5433      |
| Redis      | 6379         | 6380      |

> **DinD note:** Port 3002 is not reachable from the agent process in Docker-in-Docker environments.
> Access the API via `docker exec asset_platform_api wget -qO- http://localhost:3001/api/...` instead.

## 2. Verify API health

```bash
# Native Docker (host access)
curl http://localhost:3002/api/health

# DinD / container exec
docker exec asset_platform_api wget -qO- http://localhost:3001/api/health
```

Expected: `{"status":"ok","environment":"development",...}`

## 3. Seed data

Auto-seeded on first start:

| Email | Password |
|-------|----------|
| `demo@dx-aiot.com` | `Demo@123` |

Three demo items created: iPhone 14 Pro, MacBook Pro 16", Honda Wave Alpha 110.

## 4. Web app (dev server)

```bash
# From repo root — use /tmp cache to avoid permission issues
npm_config_cache=/tmp/npm-cache npm install --workspace=apps/web
npm_config_cache=/tmp/npm-cache npm run dev --workspace=apps/web
# → http://localhost:3000
```

Production build check:
```bash
npm_config_cache=/tmp/npm-cache npm run build --workspace=apps/web
# 15 routes, TypeScript clean, no errors
```

## 5. Auth — httpOnly cookies + CSRF

- Login: `POST /api/auth/login` → sets `access_token` (httpOnly, SameSite=Strict), `refresh_token` (httpOnly), `csrf-token` (JS-readable)
- Mutating endpoints (POST/PUT/PATCH/DELETE) require:
  - Both cookies: `Cookie: access_token=<jwt>; csrf-token=<csrf>`
  - Header: `x-csrf-token: <csrf>` (must match cookie value — timing-safe compare)
- GET/HEAD/OPTIONS are CSRF-exempt

## 6. Required environment variables

All have dev-safe defaults in `docker-compose.yml`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL DSN |
| `REDIS_URL` | Redis DSN |
| `JWT_SECRET` | Access token signing |
| `REFRESH_TOKEN_SECRET` | Refresh token signing |
| `OPENAI_API_KEY` | AI features (empty = local mock mode) |
| `OPENAI_LOCAL_MODE` | Mock AI responses (`true` in dev) |
| `MOMO_PARTNER_CODE` | MoMo payment gateway |
| `MOMO_ACCESS_KEY` | MoMo payment gateway |
| `MOMO_SECRET_KEY` | MoMo payment gateway |
| `MOMO_ENDPOINT` | MoMo API endpoint |

## 7. Full E2E validation sequence (DXS-88)

Run these in order to validate the full local stack:

```
1.  docker compose down -v && docker compose up -d --build
2.  GET  /api/health                      → 200 {"status":"ok"}
3.  POST /api/auth/register               → 201 user created
4.  POST /api/auth/login                  → 200 httpOnly cookies set
5.  GET  /api/auth/me                     → 200 user profile
6.  GET  /api/items/my                    → 200 item list
7.  GET  /api/items/my/value              → 200 portfolio total
8.  POST /api/items (+ CSRF)              → 201 item created
9.  GET  /api/items/export                → 200 text/csv
10. DELETE /api/items/:id (+ CSRF)        → 204 no content
11. GET  /api/reports/insurance           → 200 application/pdf
12. POST /api/ai/valuation                → 201 estimated value
13. POST /api/ai/barcode-lookup           → 201 endpoint responsive
14. POST /api/ai/ocr-receipt              → 201 structured receipt
15. GET  /api/marketplace/listings        → 200 listing array
16. npm run build --workspace=apps/web    → clean, 15 routes
```

## 8. Troubleshooting

### Stale routes after `docker compose up --build`

**Symptom:** `GET /api/items/export` returns 500, `DELETE /api/items/:id` returns 404, `GET /api/marketplace/listings` returns 404.

**Root cause:** `apps/api/dist/src/` contains a stale `tsc`-compiled build included in the Docker image (`.dockerignore` only excluded root-level `dist/`, not `apps/api/dist/`). SWC outputs to `apps/api/dist/` but `nest start` runs from `apps/api/dist/src/`.

**Fixed in:** `.dockerignore` now includes `**/dist` — fresh `--build` runs won't include stale compiled output.

**One-time fix for running containers:**
```bash
docker exec asset_platform_api sh -c "
  cd /app && npm run build --workspace=@dx-aiot/api
  cd apps/api/dist
  for d in */; do dir=\${d%/}; [ \"\$dir\" != 'src' ] && cp -r \"\$dir\" src/; done
  cp *.js src/ 2>/dev/null || true
  touch src/app.module.ts
"
```

### MoMo gateway crash on startup

**Symptom:** `Error: Config.getOrThrow('MOMO_PARTNER_CODE')` — server fails to start.

**Fix:** Ensure `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_ENDPOINT` are set. Sandbox defaults are now in `docker-compose.yml`.

### npm cache permission errors (agent/DinD environment)

```bash
# Always prefix npm commands:
npm_config_cache=/tmp/npm-cache npm install ...
npm_config_cache=/tmp/npm-cache npm run build ...
```
