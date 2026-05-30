import type { LoginCredentials, RegisterCredentials, AuthResponse, User } from '@/types/auth';
import { getApiBaseUrl } from './api-base-url';

const API_URL = getApiBaseUrl();

export class AuthError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
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

export async function refreshToken(): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/refresh', {
    method: 'POST',
  });
}

export async function getProfile(): Promise<User> {
  return fetchApi<User>('/auth/me', {
    method: 'GET',
  });
}

export async function logout(): Promise<void> {
  return fetchApi<void>('/auth/logout', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': getCsrfToken(),
    },
  });
}
