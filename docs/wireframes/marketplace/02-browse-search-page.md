# Flow 2: Listing Browse/Search

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Header: Marketplace                                             [Post Listing] |
+--------------------------------------------------------------------------------+
| Search: [ Search listings by keyword............................ ] [Search]    |
+--------------------------------------------------------------------------------+
| Filters                                                                         |
| [Category v] [Price min-max] [Condition v] [Distance v] [Sort v] [Reset]      |
+--------------------------------------------------------------------------------+
| Results (Grid)                                                                   |
| +------------------+ +------------------+ +------------------+ +-------------+ |
| | image            | | image            | | image            | | image       | |
| | title            | | title            | | title            | | title       | |
| | $price / period  | | $price / period  | | $price / period  | | $price      | |
| | cond • distance  | | cond • distance  | | cond • distance  | | cond • dist | |
| | [View Details]   | | [View Details]   | | [View Details]   | | [View]      | |
| +------------------+ +------------------+ +------------------+ +-------------+ |
+--------------------------------------------------------------------------------+
| Pagination: [< Prev] 1 2 3 ... [Next >]                                        |
+--------------------------------------------------------------------------------+
```

## Responsive Behavior

- Desktop: 4-column grid + horizontal filter row.
- Tablet: 2-column grid.
- Mobile: 1-column cards + filters in slide-over drawer.
