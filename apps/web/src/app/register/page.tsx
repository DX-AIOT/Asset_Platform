'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import PasswordStrength from '@/components/PasswordStrength';
import { useToast } from '@/contexts/ToastContext';
import { Logo } from '@/components/ui/logo';

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const nextErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      nextErrors.email = 'Please enter a valid email address';
    }
    if (firstName.trim().length === 0) {
      nextErrors.firstName = 'First name is required';
    }
    if (lastName.trim().length === 0) {
      nextErrors.lastName = 'Last name is required';
    }
    if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setLoading(false);
      return;
    }

    try {
      await register({ email, password, firstName, lastName });
      showToast({ variant: 'success', title: 'Account created', description: 'Welcome aboard.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setErrors({ form: message });
      showToast({ variant: 'error', title: 'Registration failed', description: message });
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (hasError: boolean) =>
    `block w-full h-11 rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent ${
      hasError
        ? 'border-red-400 bg-red-50 focus:ring-red-400'
        : 'border-gray-300 bg-white hover:border-gray-400 focus:ring-blue-500'
    }`;

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
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Create account</h2>
          <p className="text-sm text-gray-500 mb-6">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>

          {errors.form && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{errors.form}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setErrors((c) => ({ ...c, firstName: '', form: '' }));
                  }}
                  className={fieldClass(!!errors.firstName)}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setErrors((c) => ({ ...c, lastName: '', form: '' }));
                  }}
                  className={fieldClass(!!errors.lastName)}
                  placeholder="Doe"
                />
                {errors.lastName && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

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
                  setEmail(e.target.value);
                  setErrors((c) => ({ ...c, email: '', form: '' }));
                }}
                className={fieldClass(!!errors.email)}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((c) => ({ ...c, password: '', form: '' }));
                }}
                className={fieldClass(!!errors.password)}
                placeholder="At least 6 characters"
              />
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>
              )}
              <PasswordStrength password={password} />
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
