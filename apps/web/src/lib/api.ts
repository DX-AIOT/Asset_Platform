import { getStoredTokens } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchWithAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const tokens = getStoredTokens();
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }

  return response.json();
}

export interface Asset {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  serial: string;
  purchaseDate: string;
  purchasePrice: number;
  condition: string;
  location: string;
  photos: string[];
  warrantyExpiry: string;
  notes: string;
  depreciatedValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetValue {
  totalItems: number;
  totalPurchaseValue: number;
  totalCurrentValue: number;
}

export async function getMyAssets(): Promise<Asset[]> {
  const res = await fetchWithAuth<{ items: Asset[] }>('/items/my');
  return res.items;
}

export async function getMyAssetsValue(): Promise<AssetValue> {
  const res = await fetchWithAuth<{ total: number; depreciated: number }>('/items/my/value');
  return {
    totalItems: 0,
    totalPurchaseValue: res.total,
    totalCurrentValue: res.depreciated,
  };
}

export async function getAssetById(id: string): Promise<Asset> {
  return fetchWithAuth<Asset>(`/items/${id}`);
}
