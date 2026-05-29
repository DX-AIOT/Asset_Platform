import { api } from './api';
import * as FileSystem from 'expo-file-system';
import { Item, ItemCategory } from '../types/item';

export interface ItemsResponse {
  items: Item[];
  total: number;
}

export interface ItemFilters {
  category?: ItemCategory;
  location?: string;
}

interface InventoryCache {
  updatedAt: string;
  totalValue: number;
  byFilterKey: Record<string, ItemsResponse>;
}

export interface InventorySnapshot {
  items: Item[];
  total: number;
  fromCache: boolean;
  cachedAt?: string;
}

const INVENTORY_CACHE_FILE = `${FileSystem.documentDirectory}inventory-cache.json`;
const DEFAULT_FILTER_KEY = '__all__';

const toFilterKey = (filters?: ItemFilters): string => {
  const category = filters?.category ?? DEFAULT_FILTER_KEY;
  const location = filters?.location ?? DEFAULT_FILTER_KEY;
  return `${category}:${location}`;
};

const readInventoryCache = async (): Promise<InventoryCache | null> => {
  try {
    const info = await FileSystem.getInfoAsync(INVENTORY_CACHE_FILE);
    if (!info.exists) return null;

    const raw = await FileSystem.readAsStringAsync(INVENTORY_CACHE_FILE);
    return JSON.parse(raw) as InventoryCache;
  } catch {
    return null;
  }
};

const writeInventoryCache = async (cache: InventoryCache): Promise<void> => {
  await FileSystem.writeAsStringAsync(INVENTORY_CACHE_FILE, JSON.stringify(cache));
};

export const itemsApi = {
  getMyItems: (filters?: ItemFilters) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.location) params.append('location', filters.location);

    return api.get<ItemsResponse>(`/items/my${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getItemById: (id: string) =>
    api.get<Item>(`/items/${id}`),

  getTotalValue: () =>
    api.get<{ total: number; depreciated: number }>('/items/my/value'),

  getInventorySnapshot: async (filters?: ItemFilters): Promise<InventorySnapshot> => {
    const filterKey = toFilterKey(filters);

    try {
      const [itemsResponse, valueResponse] = await Promise.all([
        itemsApi.getMyItems(filters),
        itemsApi.getTotalValue(),
      ]);

      const cache = (await readInventoryCache()) ?? {
        updatedAt: new Date().toISOString(),
        totalValue: 0,
        byFilterKey: {},
      };
      cache.updatedAt = new Date().toISOString();
      cache.totalValue = valueResponse.data.total;
      cache.byFilterKey[filterKey] = itemsResponse.data;
      await writeInventoryCache(cache);

      return {
        items: itemsResponse.data.items,
        total: valueResponse.data.total,
        fromCache: false,
      };
    } catch (error) {
      const cache = await readInventoryCache();
      const cachedItems = cache?.byFilterKey[filterKey];
      if (cache && cachedItems) {
        return {
          items: cachedItems.items,
          total: cache.totalValue,
          fromCache: true,
          cachedAt: cache.updatedAt,
        };
      }

      throw error;
    }
  },
};
