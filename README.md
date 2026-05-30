# DX Solutions AIoT Asset Platform

[![CI](https://github.com/DX-AIOT/Asset_Platform/actions/workflows/ci.yml/badge.svg)](https://github.com/DX-AIOT/Asset_Platform/actions/workflows/ci.yml)

Monorepo cho Asset Platform với Mobile App, Web Dashboard và Backend API.

## 📦 Cấu trúc Monorepo

```
Asset_Platform/
├── apps/
│   ├── mobile/          # React Native app (iOS/Android)
│   ├── web/             # Next.js dashboard
│   └── api/             # NestJS/FastAPI backend
├── packages/
│   └── shared/          # Shared types, utilities, constants
├── .env.template        # Environment variables template
└── README.md
```

## 🚀 Quick Start

### Option 1: Docker (Recommended - Nhanh nhất!)

**Prerequisites:** Docker và Docker Compose

```bash
# Clone repository
git clone https://github.com/DX-AIoT/Asset_Platform.git
cd Asset_Platform

# Start tất cả services
docker compose up

# Hoặc chạy ở background
docker compose up -d
```

✅ **Done!** API sẽ chạy ở http://localhost:3001 với:

- PostgreSQL + pgvector extension
- Redis cache
- 3 sample assets đã được seed sẵn

Xem thêm: [Docker Setup Guide](./docker/README.md)

---

### Option 2: Manual Setup (< 15 phút)

**Prerequisites:**

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git**
- **PostgreSQL** (cho database)
- **Redis** (cho caching)

### Bước 1: Clone Repository

```bash
git clone https://github.com/DX-AIoT/Asset_Platform.git
cd Asset_Platform
```

### Bước 2: Cài đặt Dependencies

```bash
npm install
```

### Bước 3: Cấu hình Environment

```bash
# Copy template
cp .env.template .env

# Chỉnh sửa .env với các giá trị thực của bạn
# Ít nhất cần cấu hình:
# - DATABASE_URL
# - JWT_SECRET
# - OPENAI_API_KEY (cho AI features)
```

### Bước 4: Chạy Development

```bash
# Chạy tất cả apps
npm run dev

# Hoặc chạy từng app riêng lẻ:
cd apps/web && npm run dev        # Web dashboard
cd apps/api && npm run dev        # Backend API
cd apps/mobile && npm run dev     # Mobile app
```

## 🌿 Branch Strategy

Chúng ta sử dụng Git Flow với 3 loại branch chính:

- **`main`** - Production-ready code, chỉ merge từ `dev` sau khi QA pass
- **`dev`** - Development branch, integration branch cho tất cả features
- **`feature/*`** - Feature branches, tạo từ `dev`
  - Format: `feature/DXS-123-short-description`
  - Merge vào `dev` qua Pull Request

### Workflow

```bash
# Tạo feature branch từ dev
git checkout dev
git pull origin dev
git checkout -b feature/DXS-123-add-asset-listing

# Làm việc và commit
git add .
git commit -m "feat(api): add asset listing endpoint"

# Push và tạo PR vào dev
git push origin feature/DXS-123-add-asset-listing
```

## 🔧 Available Scripts

Từ root directory:

```bash
npm run dev          # Start tất cả apps ở dev mode
npm run build        # Build tất cả apps
npm run lint         # Lint tất cả code
npm run format       # Format code với Prettier
npm run typecheck    # TypeScript type checking
npm run test         # Run tất cả tests
npm run clean        # Xóa node_modules và build artifacts
```

## 📝 Commit Convention

Chúng ta tuân theo [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting, missing semicolons, etc
- refactor: Code restructuring
- test: Adding tests
- chore: Maintenance tasks
```

**Ví dụ:**

```
feat(mobile): add camera capture for asset photos
fix(api): resolve PostgreSQL connection timeout
docs(readme): update setup instructions
```

## 🔐 Secret Management

- ❌ **NEVER** commit `.env` files
- ✅ Sử dụng `.env.template` để document required variables
- ✅ Production secrets quản lý qua AWS Secrets Manager / Vercel Environment Variables
- ✅ Development secrets: mỗi dev có `.env.local` riêng

## 🏗️ Tech Stack

### Mobile (`apps/mobile`)

- React Native + Expo
- TypeScript
- React Navigation

### Web (`apps/web`)

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

### API (`apps/api`)

- NestJS / FastAPI
- PostgreSQL
- Redis
- OpenAI Integration

### Shared (`packages/shared`)

- Shared TypeScript types
- Common utilities
- API client SDK

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests for specific app
cd apps/web && npm test
```

## 📚 Documentation

- [Architecture Decision Records](./docs/adr/)
- [API Documentation](./apps/api/README.md)
- [Mobile App Guide](./apps/mobile/README.md)
- [Web Dashboard Guide](./apps/web/README.md)

## 👥 Team

Được phát triển bởi **DX Solutions Team**

- **CTO**: Architecture & Technical Direction
- **FrontendDev**: Next.js Web Dashboard
- **MobileDev**: React Native Mobile App
- **BackendDev**: NestJS API & Database
- **AIDataEngineer**: AI/ML Integration
- **QADevOps**: Testing, CI/CD, Infrastructure

## 📞 Support

Gặp vấn đề? Liên hệ:

- Email: tunb@aiot-global.com
- Tạo issue trên GitHub

---

**Happy Coding! 🚀**
