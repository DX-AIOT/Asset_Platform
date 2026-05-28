'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User, LoginCredentials, RegisterCredentials } from '@/types/auth';
import * as authApi from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    try {
      const tokens = authApi.getStoredTokens();
      if (!tokens) {
        setLoading(false);
        return;
      }

      const profile = await authApi.getProfile(tokens.accessToken);
      setUser(profile);
    } catch (error) {
      // Token might be expired, try refresh
      await refreshSession();
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const tokens = authApi.getStoredTokens();
      if (!tokens?.refreshToken) {
        authApi.clearTokens();
        setUser(null);
        return;
      }

      const response = await authApi.refreshToken(tokens.refreshToken);
      authApi.storeTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
      setError(null);
    } catch (error) {
      authApi.clearTokens();
      deleteCookie('auth_token');
      setUser(null);
      setError('Session expired, please login again');
    }
  };

  const clearError = () => {
    setError(null);
  };

  const setCookie = (name: string, value: string, days: number = 7) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
  };

  const deleteCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  };

  const login = async (credentials: LoginCredentials) => {
    const response = await authApi.login(credentials);
    authApi.storeTokens(response.accessToken, response.refreshToken);
    setCookie('auth_token', 'true');
    setUser(response.user);
    router.push('/dashboard');
  };

  const register = async (credentials: RegisterCredentials) => {
    const response = await authApi.register(credentials);
    authApi.storeTokens(response.accessToken, response.refreshToken);
    setCookie('auth_token', 'true');
    setUser(response.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      const tokens = authApi.getStoredTokens();
      if (tokens?.accessToken) {
        await authApi.logout(tokens.accessToken);
      }
    } finally {
      authApi.clearTokens();
      deleteCookie('auth_token');
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, register, logout, refreshSession, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
