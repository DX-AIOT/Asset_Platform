# Routing Plan

## New Pages / Routes

- `/marketplace`
- `/marketplace/new`
- `/marketplace/new/confirm` (optional explicit route if step is route-based)
- `/marketplace/[listingId]`
- `/marketplace/my-listings`
- `/marketplace/my-listings/[listingId]/edit`
- `/marketplace/offers`
- `/marketplace/offers/[offerId]`
- `/marketplace/transactions/[transactionId]`

## Optional Query Patterns

- `/marketplace?category=heavy-equipment&condition=used&min=100&max=1000&distance=25`
- `/marketplace/my-listings?tab=active|sold|drafts`

## Navigation Integration

- Add primary nav link: `Marketplace`
- Add contextual CTA buttons:
  - Browse page: `Post Listing`
  - My listings: `New Listing`
  - Detail page: `Chat Seller`, `Make Offer`, `Buy`, `Rent`

## Access and Guards (Frontend)

- Unauthenticated users:
  - Can browse listing cards and listing detail.
  - Must authenticate before posting listing, making offers, or payment steps.
- Authenticated users:
  - Full listing creation and offers/transactions access.
