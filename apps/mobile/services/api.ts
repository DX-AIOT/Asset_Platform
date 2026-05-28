import axios from 'axios';
import { authStorage } from './authStorage';

const DEFAULT_API_URL = 'http://localhost:3001/api';

const normalizeApiUrl = (url?: string): string => {
  const base = (url || DEFAULT_API_URL).trim().replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
};

const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await authStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await authStorage.getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          await authStorage.setTokens(accessToken, newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        await authStorage.clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
}

export const authApi = {
  register: (data: RegisterData) =>
    api.post<AuthResponse>('/auth/register', data),

  login: (data: LoginData) =>
    api.post<AuthResponse>('/auth/login', data),

  getProfile: () =>
    api.get<UserProfile>('/auth/me'),

  logout: () =>
    api.post('/auth/logout'),
};

export interface CreateItemData {
  name: string;
  brand?: string;
  model?: string;
  category: string;
  serial?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  condition?: string;
  location?: string;
  photos?: string[];
  notes?: string;
}

export interface ItemResponse {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  serial?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  condition: string;
  location?: string;
  photos?: string[];
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export const itemsApi = {
  create: (data: CreateItemData) =>
    api.post<ItemResponse>('/items', data),

  getAll: () =>
    api.get<ItemResponse[]>('/items'),

  getById: (id: string) =>
    api.get<ItemResponse>(`/items/${id}`),

  update: (id: string, data: Partial<CreateItemData>) =>
    api.patch<ItemResponse>(`/items/${id}`, data),

  delete: (id: string) =>
    api.delete(`/items/${id}`),

  uploadPhoto: (formData: FormData) =>
    api.post<{ url: string }>('/items/upload-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};
