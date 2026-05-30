import { refreshToken, getCsrfToken, AuthError } from './auth';
import type {
  ItemsListResponse,
  Item,
  ItemCategory,
  ItemDepreciationResponse,
  PortfolioValueResponse,
  PriceHistoryResponse,
  CreateItemInput,
  ConditionAssessmentResult,
} from '@/types/items';
import type {
  Listing,
  ListingsPage,
  MyListingsPage,
  CreateListingInput,
  UpdateListingInput,
  ListingPriceSuggestion,
  ListingAutofillDraft,
  ListingCondition,
} from '@/types/listings';
import type { AdminTransaction, AdminTransactionsResponse, TransactionStatus } from '@/types/admin';
import { getApiBaseUrl } from './api-base-url';

const API_URL = getApiBaseUrl();

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function buildHeaders(method: string, extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (MUTATING_METHODS.has(method.toUpperCase())) {
    headers['X-CSRF-Token'] = getCsrfToken();
  }
  if (extra) {
    const extraEntries =
      extra instanceof Headers
        ? Array.from(extra.entries())
        : Array.isArray(extra)
          ? extra
          : Object.entries(extra as Record<string, string>);
    for (const [k, v] of extraEntries) {
      headers[k] = v;
    }
  }
  return headers;
}

async function fetchWithAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const method = options?.method ?? 'GET';
  const headers = buildHeaders(method, options?.headers);

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (response.status === 401) {
    // Try refresh — cookies handle the token exchange.
    // Headers must be rebuilt after refresh because refreshToken() rotates the
    // csrf-token cookie; reusing pre-refresh headers causes a CsrfGuard 403.
    try {
      await refreshToken();

      const retried = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: buildHeaders(method, options?.headers),
      });
      if (!retried.ok) throw new AuthError('Request failed after refresh', retried.status);
      return retried.json();
    } catch {
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

export async function createItem(data: CreateItemInput): Promise<Item> {
  return fetchWithAuth<Item>('/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateItem(id: string, data: Partial<CreateItemInput>): Promise<Item> {
  return fetchWithAuth<Item>(`/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function assessCondition(
  imageBase64: string,
  mimeType: string,
  itemId?: string
): Promise<ConditionAssessmentResult> {
  return fetchWithAuth<ConditionAssessmentResult>('/ai/condition-assessment', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64,
      mimeType,
      itemId,
    }),
  });
}

export async function getMyPortfolioValue(): Promise<PortfolioValueResponse> {
  return fetchWithAuth<PortfolioValueResponse>('/items/my/value');
}

export async function getItemDepreciation(id: string): Promise<ItemDepreciationResponse> {
  return fetchWithAuth<ItemDepreciationResponse>(`/items/${id}/depreciation`);
}

export async function getItemPriceHistory(id: string): Promise<PriceHistoryResponse> {
  return fetchWithAuth<PriceHistoryResponse>(`/items/${id}/price-history`);
}

// ── Marketplace ───────────────────────────────────────────────────────────────

export async function browseListings(params?: {
  q?: string;
  category?: string;
  condition?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  limit?: number;
}): Promise<ListingsPage> {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.category) query.set('category', params.category);
  if (params?.condition) query.set('condition', params.condition);
  if (params?.priceMin !== undefined) query.set('priceMin', String(params.priceMin));
  if (params?.priceMax !== undefined) query.set('priceMax', String(params.priceMax));
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  return fetchWithAuth<ListingsPage>(`/marketplace/listings${qs ? `?${qs}` : ''}`);
}

export async function getListing(id: string): Promise<Listing> {
  return fetchWithAuth<Listing>(`/marketplace/listings/${id}`);
}

export async function getMyListings(): Promise<MyListingsPage> {
  return fetchWithAuth<MyListingsPage>('/marketplace/my-listings');
}

export async function createListing(data: CreateListingInput): Promise<Listing> {
  return fetchWithAuth<Listing>('/marketplace/listings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateListing(id: string, data: UpdateListingInput): Promise<Listing> {
  return fetchWithAuth<Listing>(`/marketplace/listings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function publishListing(id: string): Promise<Listing> {
  return fetchWithAuth<Listing>(`/marketplace/listings/${id}/publish`, { method: 'POST' });
}

export async function unpublishListing(id: string): Promise<Listing> {
  return fetchWithAuth<Listing>(`/marketplace/listings/${id}/unpublish`, { method: 'POST' });
}

export async function deleteListing(id: string): Promise<void> {
  await fetchWithAuth<void>(`/marketplace/listings/${id}`, { method: 'DELETE' });
}

export async function getListingAutofill(itemId: string): Promise<ListingAutofillDraft> {
  return fetchWithAuth<ListingAutofillDraft>(`/ai/listing-autofill/${itemId}`);
}

export async function suggestListingPrice(params: {
  itemId: string;
  condition?: ListingCondition;
}): Promise<ListingPriceSuggestion> {
  return fetchWithAuth<ListingPriceSuggestion>('/ai/listing-price-suggest', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getAdminTransactions(params?: {
  status?: TransactionStatus;
}): Promise<AdminTransactionsResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return fetchWithAuth<AdminTransactionsResponse>(`/admin/transactions${qs ? `?${qs}` : ''}`);
}

export async function resolveAdminTransaction(
  id: string,
  resolution: 'BUYER_REFUNDED' | 'SELLER_RELEASED'
): Promise<AdminTransaction> {
  return fetchWithAuth<AdminTransaction>(`/admin/transactions/${id}/resolve-dispute`, {
    method: 'POST',
    body: JSON.stringify({ resolution }),
  });
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getInsuranceReportPdf(categoryIds?: string[]): Promise<Blob> {
  const query = new URLSearchParams({ format: 'pdf' });
  if (categoryIds && categoryIds.length > 0) {
    query.set('categoryIds', categoryIds.join(','));
  }

  const endpoint = `/reports/insurance?${query.toString()}`;

  const fetchReport = (): Promise<Response> =>
    fetch(`${API_URL}${endpoint}`, {
      credentials: 'include',
    });

  let response = await fetchReport();

  if (response.status === 401) {
    try {
      await refreshToken();
      response = await fetchReport();
    } catch {
      throw new AuthError('Session expired', 401);
    }
  }

  if (!response.ok) {
    throw new AuthError('Failed to generate insurance report', response.status);
  }

  return response.blob();
}
