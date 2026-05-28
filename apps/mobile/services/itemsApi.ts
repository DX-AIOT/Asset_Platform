import { api } from './api';
import { Item, ItemCategory } from '../types/item';

export interface ItemsResponse {
  items: Item[];
  total: number;
}

export interface ItemFilters {
  category?: ItemCategory;
  location?: string;
}

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
};
