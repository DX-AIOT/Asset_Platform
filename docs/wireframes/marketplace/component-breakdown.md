# Component Breakdown

## Reusable From Existing Asset UI (Expected)

- `AppShell` layout with header/sidebar containers
- Shared `Button`, `Input`, `Select`, `Textarea`, `Badge`, `Tabs`, `Modal`, `Card`
- Existing image uploader primitives (if used in asset create/edit flows)
- Pagination and empty-state components

## New Marketplace-Specific Components

- `ListingWizardStepper`
- `ListingPhotoUploader` (multi-image reorder + cover selection)
- `ListingDetailsForm`
- `ListingPricingForm`
- `ListingConfirmSummary`
- `MarketplaceFilterBar`
- `MarketplaceGrid`
- `ListingCard`
- `ListingGallery`
- `ListingSellerCard`
- `ListingActionPanel` (buy/rent/offer/chat CTAs)
- `MyListingsStatusTabs`
- `MyListingsTable` / `MyListingCardMobile`
- `OfferModal`
- `OfferTimeline` (pending/accepted/declined/counter)
- `TransactionSummaryPanel`

## Type Definitions Needed

- `MarketplaceListing`
- `ListingCondition`
- `ListingType` (`sell | rent`)
- `Offer`
- `OfferStatus`
- `Transaction`
- `TransactionStatus`

## Suggested Folder Structure

```text
apps/web/src/components/marketplace/
  listing-wizard/
  browse/
  detail/
  my-listings/
  offers/
```
