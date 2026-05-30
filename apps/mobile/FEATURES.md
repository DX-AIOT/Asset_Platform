# Mobile Feature Documentation

This document describes mobile feature behavior as currently implemented in `apps/mobile`.

## Feature Overview

| Feature | Status | Main Screens | API/Service |
|---|---|---|---|
| Authentication | Implemented | `(auth)/login`, `(auth)/register` | `authApi`, `AuthContext` |
| AI asset scan from camera | Implemented | `(app)/camera`, `(app)/review` | `aiApi.recognizeAsset` |
| Barcode/QR scan for item prefill | Implemented | `(app)/camera`, `(app)/add-item` | `aiApi.lookupBarcode` |
| Manual add item with photos | Implemented | `(app)/add-item` | `itemsApi.create` |
| Inventory list + category filter | Implemented | `(app)/inventory` | `itemsApi.getMyItems` |
| Inventory total value | Implemented | `(app)/inventory` | `itemsApi.getTotalValue` |
| Insurance PDF export/share | Implemented | `(app)/inventory` | `reportsApi.generateInsurancePdf` |
| Item detail view | Implemented | `item/[id]` | `itemsApi.getItemById` |
| Maintenance reminders | Implemented | `item/[id]` | `remindersApi` |
| Family sharing invite/revoke/list | Implemented | `(app)/sharing` | `sharingApi` |
| Invite acceptance via deep link | Implemented | `sharing/accept/[token]` | `sharingApi.acceptInvite` |
| Save recognized item from review | Partial | `(app)/review` | TODO in screen logic |

## Authentication

- Secure token persistence via `expo-secure-store`.
- Auto-login flow uses stored tokens and `/auth/me` profile fetch.
- Axios interceptor attaches `Authorization: Bearer <token>`.
- On `401`, refresh flow retries with `/auth/refresh`; failed refresh clears stored tokens.

## Camera And AI Recognition

- Camera permissions handled with `Camera.useCameraPermissions()`.
- Capture flow:
  1. Capture photo or choose from gallery in `(app)/camera`.
  2. Navigate to `(app)/review` with `imageUri`.
  3. `aiApi.recognizeAsset` sends base64 image payload to `/ai/recognize`.
  4. UI displays confidence/latency and allows user edits.
- Low-confidence responses trigger manual verification banner.

## Barcode / QR Lookup

- Barcode mode is triggered via `/(app)/camera?mode=barcode`.
- First scan routes to add-item with `scannedBarcode`.
- `add-item` screen calls `aiApi.lookupBarcode` and pre-fills name/brand/category/serial when available.
- If no product found, barcode is still persisted into serial field for manual entry.

## Inventory And Reporting

- Inventory supports pull-to-refresh and category filters.
- Total value summary is shown in header card.
- Insurance report export flow:
  1. Request PDF bytes from reports API.
  2. Write to `expo-file-system` cache.
  3. Share native file URL via `Share.share`.

## Item Details And Maintenance Reminders

- Item details include metadata, pricing, purchase dates, warranty, notes, and photo carousel.
- Reminder capabilities:
  - create recurring reminders (`title`, `intervalDays`, optional notes)
  - list reminders per item
  - mark reminder done and refresh schedule

## Family Sharing

- Invite by email from mobile.
- View members with status (`pending`/`active`) and permission.
- Revoke active access when `userId` exists.
- View inventories shared with current user.
- Accept invite route consumes token from deep link and returns to sharing screen.

## Mobile-Specific Behavior

- Platform-specific local API host handling documented in setup guide.
- Camera and photo-library permission prompts managed in app.
- Deep-link scheme: `assetplatform://`.

## Known Limitations

- `(app)/review` currently shows success but does not persist via inventory API (`TODO: Save to inventory API`).
- Shared inventory item-level browsing depends on backend shared-items support.
