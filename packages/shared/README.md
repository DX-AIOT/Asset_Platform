# Shared Package

Shared TypeScript types, utilities, và constants dùng chung cho tất cả apps.

## Usage

```typescript
import { Asset, ApiResponse, formatDate } from '@dx-aiot/shared';

const asset: Asset = {
  id: '1',
  name: 'My Asset',
  createdAt: new Date(),
  updatedAt: new Date(),
};

console.log(formatDate(asset.createdAt));
```

## Structure

- `types/` - Shared TypeScript interfaces và types
- `utils/` - Utility functions
- `constants/` - Shared constants
