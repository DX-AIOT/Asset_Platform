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
