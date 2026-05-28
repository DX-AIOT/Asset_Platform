import { getStoredTokens, storeTokens, clearTokens, refreshToken, AuthError } from './auth';
import type { ItemsListResponse, Item, ItemCategory } from '@/types/items';
import { getApiBaseUrl } from './api-base-url';

const API_URL = getApiBaseUrl();

async function fetchWithAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const tokens = getStoredTokens();
  if (!tokens) throw new AuthError('Not authenticated', 401);

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    // Try refresh
    try {
      const refreshed = await refreshToken(tokens.refreshToken);
      storeTokens(refreshed.accessToken, refreshed.refreshToken);

      const retried = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshed.accessToken}`,
          ...options?.headers,
        },
      });
      if (!retried.ok) throw new AuthError('Request failed after refresh', retried.status);
      return retried.json();
    } catch {
      clearTokens();
      throw new AuthError('Session expired', 401);
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new AuthError(error.message || 'Request failed', response.status);
  }

  return response.json();
}

export async function getMyItems(params?: {
  category?: ItemCategory;
  location?: string;
}): Promise<ItemsListResponse> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.location) query.set('location', params.location);
  const qs = query.toString();
  return fetchWithAuth<ItemsListResponse>(`/items/my${qs ? `?${qs}` : ''}`);
}

export async function getItem(id: string): Promise<Item> {
  return fetchWithAuth<Item>(`/items/${id}`);
}
