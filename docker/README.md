# Docker Setup for Local Development

Docker Compose configuration cho Asset Platform development environment.

## 📦 Services

### PostgreSQL (port 5432)

- Image: `pgvector/pgvector:pg16`
- Database: `asset_platform`
- User: `asset_user`
- Password: `asset_pass_dev` (chỉ dùng cho local dev)
- Extensions: `pgvector`, `uuid-ossp`
- Volume: Persistent data trong `postgres_data`

### Redis (port 6379)

- Image: `redis:7-alpine`
- Sử dụng cho caching và job queue
- Volume: Persistent data trong `redis_data`

### NestJS API (port 3001)

- Build từ `./apps/api/Dockerfile`
- Hot reload enabled (mount source code)
- Tự động khởi động khi postgres và redis ready

## 🚀 Quick Start

### 1. Start all services

```bash
# Từ root directory của project
docker compose up

# Hoặc chạy detached mode
docker compose up -d
```

### 2. Check services health

```bash
# Xem logs
docker compose logs -f

# Xem logs của service cụ thể
docker compose logs -f api
docker compose logs -f postgres
docker compose logs -f redis

# Check status
docker compose ps
```

### 3. Access services

- **API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 4. Seed data

Database tự động được seed với demo data khi khởi động lần đầu:

- 1 demo user: `demo@dxaiot.com` / `demo123`
- 3 sample assets:
  - Dell Latitude 5520 Laptop (ASSET-LAPTOP-001)
  - Epson L3150 Printer (ASSET-PRINTER-002)
  - Herman Miller Aeron Chair (ASSET-CHAIR-003)

## 🔧 Management Commands

### Stop all services

```bash
docker compose down
```

### Stop and remove volumes (reset database)

```bash
docker compose down -v
```

### Rebuild API service

```bash
docker compose build api
docker compose up -d api
```

### Access PostgreSQL CLI

```bash
docker compose exec postgres psql -U asset_user -d asset_platform
```

### Access Redis CLI

```bash
docker compose exec redis redis-cli
```

### View API logs

```bash
docker compose logs -f api
```

## 🗄️ Database Schema

Tables tự động được tạo khi khởi động:

- `users` - User accounts
- `assets` - Asset records với pgvector embedding
- `asset_history` - Audit trail

## 🔍 Useful SQL Queries

### Check extensions

```sql
SELECT extname, extversion FROM pg_extension;
```

### View all assets

```sql
SELECT id, name, category, status, location, qr_code FROM assets;
```

### Check seed data

```sql
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Assets', COUNT(*) FROM assets
UNION ALL
SELECT 'Asset History', COUNT(*) FROM asset_history;
```

## 🧹 Troubleshooting

### Port conflicts

Nếu port 5432, 6379, hoặc 3001 đã được sử dụng, sửa trong `docker-compose.yml`:

```yaml
ports:
  - '5433:5432' # Change 5432 to 5433
```

### Reset database

```bash
# Stop và xóa volumes
docker compose down -v

# Start lại (sẽ tạo mới database và seed data)
docker compose up
```

### Permission issues

```bash
# Fix volume permissions
docker compose down
sudo chown -R $USER:$USER ./
docker compose up
```

## 📝 Environment Variables

Xem file `docker-compose.yml` để biết các environment variables được sử dụng.
Các giá trị này chỉ dùng cho local development, **KHÔNG** dùng cho production.

## 🔐 Security Notes

⚠️ **CẢNH BÁO**: Configuration này chỉ dùng cho local development!

- Database password là hardcoded (không an toàn cho production)
- JWT secrets là demo values
- Không có SSL/TLS
- Không có network isolation

Để deploy production, xem deployment guides trong `docs/deployment/`.
