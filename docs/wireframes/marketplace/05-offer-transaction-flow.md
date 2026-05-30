# Flow 5: Offer & Transaction

## State Flow

`Make Offer -> Seller Decision -> Payment -> Completion`

## Wireframe Sequence

```text
[Make Offer Modal]
+----------------------------------------------------------+
| Your Offer Amount: [________]                            |
| Message to Seller: [optional...........................]  |
| [Cancel]                                   [Send Offer]  |
+----------------------------------------------------------+

[Seller Decision Panel]
+----------------------------------------------------------+
| Offer from BuyerX: $950                                  |
| [Accept] [Decline] [Counter Offer]                       |
+----------------------------------------------------------+

[Payment Step]
+----------------------------------------------------------+
| Order Summary                                             |
| Item: Forklift A                                          |
| Offer Accepted: $950                                      |
| Fees / Total                                              |
| Payment Method [card v]                                   |
| [Pay Now]                                                 |
+----------------------------------------------------------+

[Completion]
+----------------------------------------------------------+
| Transaction Complete                                      |
| [Download Receipt] [Message Seller] [View Listing]       |
+----------------------------------------------------------+
```

## Event/Status Mapping

- Offer statuses: `pending`, `accepted`, `declined`, `countered`, `expired`
- Transaction statuses: `awaiting_payment`, `paid`, `fulfilled`, `completed`, `cancelled`
