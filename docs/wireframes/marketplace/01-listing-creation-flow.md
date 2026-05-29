# Flow 1: Listing Creation (Multi-Step)

## Step Map

`Upload Photos -> Details -> Pricing -> Confirm -> Published`

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Header: [Back] Create Listing                                     Step 1 of 4 |
+--------------------------------------------------------------------------------+
| Stepper: [1 Upload] -- [2 Details] -- [3 Pricing] -- [4 Confirm]              |
+--------------------------------------------------------------------------------+
| Main                                                                            |
|  +-----------------------------------+  +------------------------------------+  |
|  | Photo Dropzone                    |  | Upload Tips                        |  |
|  | [ Drag images here ]              |  | - Min 3 photos                     |  |
|  | [ Browse Files ]                  |  | - Good lighting                    |  |
|  +-----------------------------------+  +------------------------------------+  |
|                                                                                |
|  Uploaded: [thumb][thumb][thumb][+add]                                        |
+--------------------------------------------------------------------------------+
| Footer Actions: [Save Draft]                               [Next: Details ->]  |
+--------------------------------------------------------------------------------+
```

## Step-Specific Fields

- Upload: `images[]` with ordering + cover selection
- Details: `title`, `category`, `brand`, `model`, `condition`, `description`, `location`
- Pricing: `listingType (sell|rent)`, `price`, `rentalPeriod`, `negotiable`, `deliveryOptions`
- Confirm: summary cards, edit links, `termsAccepted`

## Validation / UX

- Block next step until required fields are valid.
- Preserve progress in draft mode between steps.
- Mobile: stepper collapses to `Step X of 4` with horizontal progress bar.
