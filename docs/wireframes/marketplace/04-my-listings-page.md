# Flow 4: My Listings Management

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Header: My Listings                                               [New Listing] |
+--------------------------------------------------------------------------------+
| Tabs: [Active (12)] [Sold (4)] [Drafts (3)]                                     |
+--------------------------------------------------------------------------------+
| Table / Cards                                                                     |
| +--------------------------------------------------------------------------------+|
| | Thumb | Title        | Price  | Status  | Views | Updated     | Actions      ||
| | img   | Forklift A   | $1200  | Active  | 204   | 2h ago      | Edit Pause   ||
| | img   | Drill B      | $300   | Draft   | --    | 1d ago      | Continue Del ||
| +--------------------------------------------------------------------------------+|
+--------------------------------------------------------------------------------+
| Bulk Actions: [Mark Sold] [Deactivate] [Delete]                                 |
+--------------------------------------------------------------------------------+
```

## Behavior

- Active: edit, pause, mark sold.
- Sold: view history, relist.
- Drafts: continue wizard from saved step.
- Mobile view: cards with overflow menu actions.
