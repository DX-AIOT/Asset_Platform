# Web Frontend Component Documentation

This document describes the current Next.js web frontend structure for the AIoT Asset Platform (`apps/web`) and the main reusable components.

## Scope

- Framework: Next.js 14 App Router
- Language: TypeScript + React
- Styling: Tailwind CSS
- UI primitives: local `src/components/ui/*`

## App Structure

- `src/app/layout.tsx`: Root layout and global providers.
- `src/app/globals.css`: Global Tailwind styles.
- `src/middleware.ts`: Route-level auth redirects.
- `src/contexts/AuthContext.tsx`: Authentication state and actions.

## Pages

### Auth Pages

- `src/app/login/page.tsx`
  - Handles email/password sign-in.
  - Performs client-side email format validation.
  - Surfaces auth errors from `AuthContext`.
- `src/app/register/page.tsx`
  - Handles account creation (first name, last name, email, password).
  - Includes `PasswordStrength` for immediate password feedback.

### Dashboard Pages

- `src/app/dashboard/page.tsx` (Overview)
  - Loads items and portfolio totals.
  - Renders summary metrics, category/location breakdowns, recent purchases, warranty alerts, and trend widgets.
  - Fetches per-item depreciation for a sparkline subset.
- `src/app/dashboard/assets/page.tsx`
  - Loads item inventory and renders the `AssetTable`.
  - Includes refresh action and placeholder Add Asset button.
- `src/app/dashboard/assets/[id]/page.tsx`
  - Asset detail page with key fields, condition/category badges, and photo gallery.
- `src/app/dashboard/reports/page.tsx`
  - Generates downloadable insurance report PDF.
  - Supports optional category filters.

### Settings

- `src/app/settings/page.tsx`
  - Tabbed profile/security view.
  - Displays current user profile fields read-only.
  - Security tab includes sign-out and placeholders for future password changes.

## Core Shared Components

### `AssetTable`

File: `src/components/assets/AssetTable.tsx`

Main responsibilities:

- Table rendering via TanStack Table.
- Client-side filtering:
  - global text search
  - category filter
  - location filter
- Sorting and pagination.
- Row selection with checkbox controls.
- Row click navigation to asset detail page.
- Export actions:
  - CSV export of visible dataset
  - Excel export (lazy loads `xlsx`)
  - Insurance report PDF export via API

Key UX behaviors:

- Thumbnail fallback icon when no photo exists.
- Currency/date formatting localized to `vi-VN`.
- Loading and error states for insurance PDF export.

Props:

- `items: Item[]` (required)
- `loading?: boolean` (optional, default `false`)

### `PasswordStrength`

File: `src/components/PasswordStrength.tsx`

Main responsibilities:

- Visual indicator for password quality during registration.
- Lightweight immediate feedback to reduce weak password submissions.

## UI Primitives (`src/components/ui`)

- `button.tsx`: Shared button variants and sizing.
- `input.tsx`: Text input primitive.
- `select.tsx`: Select/dropdown primitive.
- `checkbox.tsx`: Checkbox input.
- `badge.tsx`: Status/category badge styles.

These primitives are used across dashboard pages to keep styling and behavior consistent.

## Auth and Routing

- Middleware protects `/dashboard/*` and `/settings` when no auth token is present.
- Middleware redirects authenticated users away from `/login` and `/register` to `/dashboard`.
- Pages also use `AuthContext` checks for client-side safety and logout flows.

## Data and API Layer

Primary frontend API utilities are in `src/lib/api.ts`, including:

- Auth operations: login/register/me/logout
- Asset operations: list/get assets, depreciation, portfolio value
- Reports: insurance report PDF generation

All page-level data loaders rely on these helpers to keep API contracts centralized.

## Notes for Future Contributors

- Keep page containers focused on data-fetching + composition.
- Move repeated visual patterns into reusable components before duplicating markup.
- Preserve strict typing from `src/types/*`; avoid `any`.
- Prefer lazy-loading heavy optional dependencies (as done with `xlsx`) to protect bundle size.
