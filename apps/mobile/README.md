# Mobile App

React Native + Expo mobile app for the AIoT Asset Platform (iOS and Android).

## Documentation

- [Feature Documentation](./FEATURES.md)

## Prerequisites

- Node.js 18+
- npm 9+
- Xcode (for iOS Simulator)
- Android Studio (for Android Emulator)
- Expo Go app (for physical-device testing)
- Running backend API (`apps/api`)

## Setup Guide

1. Install workspace dependencies from repo root:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.template .env
```

3. Set the mobile API endpoint in `.env`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

Use the correct host per target:

- iOS Simulator: `http://localhost:3001/api`
- Android Emulator: `http://10.0.2.2:3001/api`
- Physical device: `http://<YOUR_LAN_IP>:3001/api`

Note: the mobile API client auto-appends `/api` if you provide only host/port.

4. Start the API (`apps/api`) and mobile app (`apps/mobile`).

```bash
# from repo root
npm run dev --workspace=@dx-aiot/api
npm run dev --workspace=@dx-aiot/mobile
```

## Running The App

From `apps/mobile`:

```bash
npm run dev      # Expo dev server
npm run ios      # iOS Simulator
npm run android  # Android Emulator
```

## Useful Verification Commands

From `apps/mobile`:

```bash
npm run lint
npm run typecheck
```

## Deep Link / Invite Flow Check

The app uses scheme `assetplatform` (`apps/mobile/app.json`).

Example (simulator/device shell):

```bash
assetplatform://sharing/accept/<invite-token>
```

## Project Structure

```text
apps/mobile/
├── app/
│   ├── (auth)/                # Login/register routes
│   ├── (app)/                 # Main authenticated routes
│   ├── item/[id].tsx          # Item detail + maintenance reminders
│   └── sharing/accept/[token] # Deep-link invite accept flow
├── components/                # Reusable mobile components
├── contexts/                  # Auth and app contexts
├── services/                  # API clients and network logic
├── types/                     # Mobile domain types
└── assets/                    # Icons/splash/images
```

## Tech Stack

- Expo SDK 50
- React Native 0.73
- Expo Router 3
- TypeScript
- Axios
- expo-camera
- expo-image-picker
- expo-file-system
- expo-secure-store
