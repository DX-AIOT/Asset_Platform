# Mobile App

React Native mobile app cho Asset Platform (iOS & Android).

## Features

- **Authentication**
  - Login with email/password
  - User registration
  - Secure token storage (expo-secure-store)
  - Auto-login on app open
  - Token refresh mechanism
  - Logout functionality

- **Manual Item Entry**
  - Add items manually when AI doesn't recognize
  - Form fields: name, brand, model, category, serial number, purchase date/price, location, notes
  - Multiple photo support (camera or gallery)
  - Category picker (Electronics, Mobile Phones, Laptops, Vehicles, Furniture, Appliances, Other)
  - Location picker (Living Room, Bedroom, Kitchen, Office, Garage, Storage, Other)
  - Photo management (add/remove multiple photos)

- **Navigation**
  - Auth stack (Login, Register)
  - Protected app stack
  - Auto-redirect based on auth state

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your API URL:
```bash
EXPO_PUBLIC_API_URL=http://your-api-url:3001/api
```

For local development:
- iOS Simulator: `http://localhost:3001/api`
- Android Emulator: `http://10.0.2.2:3001/api`
- Physical device: `http://YOUR_LOCAL_IP:3001/api`

The mobile API client normalizes this value and automatically appends `/api` if you provide only host/port.

## Development

Start the Expo development server:
```bash
npm run dev
```

## Run on Device/Emulator

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android
```

Scan the QR code with:
- iOS: Camera app
- Android: Expo Go app

## Project Structure

```
apps/mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Auth screens (public)
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (app)/             # Protected app screens
│   │   └── index.tsx
│   ├── _layout.tsx        # Root layout with AuthProvider
│   └── index.tsx          # Entry point with auth redirect
├── contexts/              # React contexts
│   └── AuthContext.tsx    # Auth state management
├── services/              # API & storage services
│   ├── api.ts            # Axios client with interceptors
│   └── authStorage.ts    # Secure token storage
└── assets/               # Images, fonts, etc.
```

## Tech Stack

- React Native 0.73
- Expo 50
- TypeScript
- Expo Router (file-based routing)
- Expo Secure Store (token storage)
- Axios (HTTP client)

## Authentication Flow

1. App opens → Check for stored tokens
2. If tokens exist → Fetch user profile → Navigate to app
3. If no tokens or invalid → Navigate to login
4. User logs in → Store tokens → Navigate to app
5. API requests use access token in Authorization header
6. If 401 error → Try refresh token → Retry request
7. If refresh fails → Clear tokens → Navigate to login

## Acceptance Criteria

✅ User can register with email/password
✅ User can login with email/password
✅ Tokens stored securely (expo-secure-store)
✅ Auto-login on app open with refresh token
✅ User can logout
✅ Navigation: auth stack vs main stack based on auth state
✅ Works on both iOS and Android
