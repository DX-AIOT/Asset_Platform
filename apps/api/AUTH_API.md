# Authentication API Documentation

## Overview

This NestJS backend provides a complete authentication system with JWT tokens, refresh tokens, and Google OAuth2 support.

## Features

- ✅ User registration with email/password
- ✅ Login with JWT access token and refresh token
- ✅ Token refresh mechanism
- ✅ User profile endpoint
- ✅ Password hashing with bcrypt
- ✅ JWT authentication guard
- ✅ Role-based authorization guard
- ✅ Google OAuth2 (prepared for integration)
- ✅ Logout functionality

## Prerequisites

1. PostgreSQL database running
2. Redis (optional, for future session management)
3. Environment variables configured

## Setup

### 1. Install Dependencies

```bash
cd apps/api
npm install
```

### 2. Configure Environment Variables

Copy the `.env.template` to `.env` in the root directory and fill in:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/asset_platform
JWT_SECRET=your-super-secret-jwt-key-change-me
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-change-me
REFRESH_TOKEN_EXPIRES_IN=30d
API_PORT=3001
```

### 3. Start the Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3001/api`

## API Endpoints

### Base URL

```
http://localhost:3001/api
```

### 1. Register User

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:** `201 Created`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

### 2. Login

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

### 3. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 4. Get Profile

**Endpoint:** `GET /auth/me`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "user"
}
```

### 5. Logout

**Endpoint:** `POST /auth/logout`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

### 6. Google OAuth (Prepared)

**Initiate:** `GET /auth/google`

**Callback:** `GET /auth/google/callback`

> Note: Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` environment variables.

## Testing with Postman

1. Import the Postman collection from `apps/api/postman/Asset_Platform_Auth.postman_collection.json`

2. Run requests in order:
   - Register User (saves tokens automatically)
   - Login User (updates tokens)
   - Get Profile (uses saved access token)
   - Refresh Token (gets new tokens)
   - Logout (clears tokens)

3. The collection automatically saves and uses tokens between requests.

## Authentication Guards

### JwtAuthGuard

Protects routes requiring authentication:

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Get('protected')
getProtectedData() {
  return 'This is protected';
}
```

### RolesGuard

Protects routes requiring specific roles:

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { UserRole } from './users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Get('admin-only')
getAdminData() {
  return 'Admin only data';
}
```

### Public Routes

Mark routes as public (skip authentication):

```typescript
import { Public } from './auth/decorators/public.decorator';

@Public()
@Get('public')
getPublicData() {
  return 'Public data';
}
```

## Database Schema

### Users Table

```typescript
{
  id: string (UUID, primary key)
  email: string (unique)
  password: string (bcrypt hashed)
  firstName: string (nullable)
  lastName: string (nullable)
  role: enum ('user', 'admin', 'super_admin')
  googleId: string (nullable)
  refreshToken: string (nullable, bcrypt hashed)
  isActive: boolean (default: true)
  createdAt: Date
  updatedAt: Date
}
```

## Security Features

1. **Password Hashing**: bcrypt with 10 salt rounds
2. **JWT Tokens**: Separate secrets for access and refresh tokens
3. **Token Expiration**: Configurable via environment variables
4. **Refresh Token Rotation**: New refresh token on each refresh
5. **Token Storage**: Refresh tokens hashed in database
6. **Input Validation**: class-validator on all DTOs
7. **CORS**: Configured for cross-origin requests

## Error Handling

The API returns standard HTTP status codes:

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid credentials or token
- `409 Conflict` - Resource already exists (e.g., email)
- `500 Internal Server Error` - Server error

## Development Tips

1. **TypeORM Auto-sync**: Enabled in development mode (creates tables automatically)
2. **Database Logging**: Enabled in development for debugging
3. **CORS**: Permissive in development, restricted in production
4. **Hot Reload**: Enabled with `npm run dev`

## Production Considerations

1. Disable TypeORM `synchronize` in production
2. Use database migrations instead
3. Configure `ALLOWED_ORIGINS` for CORS
4. Use strong, random secrets for JWT
5. Enable HTTPS
6. Add rate limiting
7. Implement refresh token rotation tracking
8. Add email verification
9. Add password reset functionality
10. Implement session management with Redis

## Next Steps

- [ ] Add email verification
- [ ] Add password reset flow
- [ ] Implement Google OAuth fully
- [ ] Add rate limiting
- [ ] Add Redis session storage
- [ ] Add 2FA support
- [ ] Add password strength validation
- [ ] Add account lockout after failed attempts
