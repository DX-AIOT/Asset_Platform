import type { LoginCredentials, RegisterCredentials, AuthResponse, User } from '@/types/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class AuthError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AuthError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new AuthError(error.message || 'Request failed', response.status);
  }

  return response.json();
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getProfile(accessToken: string): Promise<User> {
  return fetchApi<User>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function logout(accessToken: string): Promise<void> {
  return fetchApi<void>('/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// Token storage helpers
export const TOKEN_STORAGE_KEY = 'auth_tokens';

export function getStoredTokens(): { accessToken: string; refreshToken: string } | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken, refreshToken }));
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
