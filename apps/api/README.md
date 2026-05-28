# Backend API

NestJS backend API cho Asset Platform.

## Local-First Development (Docker Compose)

Run local dependencies without cloud credentials:

```bash
docker compose up -d postgres redis
```

Use root `.env` with local defaults:

```env
DATABASE_URL=postgresql://asset_user:asset_pass_dev@localhost:5432/asset_platform
REDIS_URL=redis://localhost:6379
OPENAI_LOCAL_MODE=true
OPENAI_API_KEY=
```

Then start API:

```bash
npm run dev
```

API sẽ chạy tại http://localhost:3001

Quick static compliance check:

```bash
./scripts/local-first-gate.sh
```

## Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- Redis
- OpenAI Integration
- JWT Authentication

## API Documentation

API docs sẽ có tại http://localhost:3001/api/docs (Swagger)
