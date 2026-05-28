const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';

function removeTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured) return DEFAULT_API_BASE_URL;
  return removeTrailingSlash(configured);
}
