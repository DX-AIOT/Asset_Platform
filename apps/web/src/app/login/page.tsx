'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Logo } from '@/components/ui/logo';

export default function LoginPage() {
  const { login, error: authError, clearError } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => { clearError(); };
  }, [clearError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const nextErrors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      nextErrors.email = 'Please enter a valid email address';
    }
    if (password.trim().length === 0) {
      nextErrors.password = 'Password is required';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setLoading(false);
      return;
    }

    try {
      await login({ email, password });
      showToast({ variant: 'success', title: 'Signed in', description: 'Welcome back.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setErrors({ form: message });
      showToast({ variant: 'error', title: 'Sign in failed', description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 tracking-wide uppercase font-medium">AIoT Asset Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-8 py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline">
              Create one
            </Link>
          </p>

          {authError && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800">{authError}</p>
            </div>
          )}

          {errors.form && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{errors.form}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  clearError();
                  setEmail(e.target.value);
                  setErrors((current) => ({ ...current, email: undefined, form: undefined }));
                }}
                className={`block w-full h-11 rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:border-transparent ${
                  errors.email
                    ? 'border-red-400 bg-red-50 focus:ring-red-400'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  clearError();
                  setPassword(e.target.value);
                  setErrors((current) => ({ ...current, password: undefined, form: undefined }));
                }}
                className={`block w-full h-11 rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:border-transparent ${
                  errors.password
                    ? 'border-red-400 bg-red-50 focus:ring-red-400'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading && (
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
