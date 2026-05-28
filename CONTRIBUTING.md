# Contributing to Asset Platform

## Branch Strategy & Git Workflow

### Branch Structure

Chúng ta sử dụng Git Flow với 3 loại branch:

#### 1. `main` - Production Branch

- **Purpose**: Code production-ready, deployed to production
- **Protection**: Protected branch, requires PR approval
- **Merge from**: `dev` branch only
- **When to merge**: Sau khi QA pass và CTO approve

#### 2. `dev` - Development Branch

- **Purpose**: Integration branch cho tất cả features
- **Protection**: Protected branch, requires PR approval
- **Merge from**: `feature/*` branches
- **When to merge**: Feature complete và pass initial testing

#### 3. `feature/*` - Feature Branches

- **Purpose**: Development của một feature cụ thể
- **Naming**: `feature/DXS-{issue-number}-{short-description}`
- **Created from**: `dev` branch
- **Merge to**: `dev` branch via Pull Request

### Workflow Example

```bash
# 1. Bắt đầu feature mới
git checkout dev
git pull origin dev
git checkout -b feature/DXS-123-asset-upload

# 2. Develop và commit thường xuyên
git add .
git commit -m "feat(api): add asset upload endpoint"

# 3. Keep feature branch updated với dev
git fetch origin
git rebase origin/dev

# 4. Push và tạo Pull Request
git push origin feature/DXS-123-asset-upload
# Tạo PR từ GitHub UI: feature/DXS-123-asset-upload → dev

# 5. Sau khi PR được approve và merge, xóa feature branch
git checkout dev
git pull origin dev
git branch -d feature/DXS-123-asset-upload
```

### Pull Request Guidelines

#### Khi tạo PR:

- ✅ Title format: `[DXS-123] Short description`
- ✅ Link đến issue trong description
- ✅ Mô tả changes và testing đã làm
- ✅ Screenshot (nếu có UI changes)
- ✅ Checklist: Tests pass, Lint pass, TypeScript pass

#### Review Process:

1. Developer tạo PR vào `dev`
2. CI/CD runs automated tests
3. Assign reviewer (usually @qadevops or @cto)
4. Reviewer comments hoặc approve
5. Resolve conflicts nếu có
6. Merge vào `dev` (squash merge preferred)

#### Release to Production:

1. CTO tạo PR: `dev` → `main`
2. QA performs full regression testing
3. QA sign-off
4. CTO approval
5. Merge vào `main`
6. Auto-deploy to production

## Commit Message Convention

Tuân theo [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding/updating tests
- `chore`: Build process, dependencies, etc
- `ci`: CI/CD configuration

### Examples

```bash
feat(mobile): add camera integration for asset photos

- Implement camera capture
- Add image compression
- Handle permissions

Closes DXS-123
```

```bash
fix(api): resolve database connection timeout

PostgreSQL connection pool was exhausted under load.
Increased pool size and added connection retry logic.

Fixes DXS-456
```

## Code Style

### TypeScript

- Use strict mode
- No `any` types (use `unknown` if needed)
- Prefer interfaces over types for objects
- Use meaningful variable names

### React/React Native

- Functional components with hooks
- Use TypeScript for props
- Keep components small and focused
- Extract reusable logic to hooks

### NestJS

- Follow NestJS best practices
- Use DTOs for validation
- Service layer for business logic
- Controllers for routing only

## Testing

### Before submitting PR:

```bash
# Run all checks
npm run lint
npm run typecheck
npm run test
npm run build
```

### Test Requirements:

- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows (added by QA)

## Questions?

Gặp vấn đề? Hỏi trong team chat hoặc tag:

- **@cto** - Architecture, technical decisions
- **@qadevops** - CI/CD, deployment, testing strategy
- **@backenddev** - API, database questions
- **@frontenddev** - Web dashboard questions
- **@mobiledev** - Mobile app questions
