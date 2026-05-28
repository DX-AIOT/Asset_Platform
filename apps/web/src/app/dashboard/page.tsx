'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Settings, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-gray-900">AIoT Asset Platform</h1>
              <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">
                Overview
              </span>
              <Link href="/dashboard/assets" className="text-sm text-gray-600 hover:text-gray-900">
                Assets
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/settings"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Settings
              </Link>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome, {user.firstName || user.email}!
          </h2>
          <div className="space-y-2 text-gray-600">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {user.role}</p>
          </div>
        </div>

        {/* Quick navigation cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/dashboard/assets"
            className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Assets</p>
              <p className="text-sm text-gray-500">View and manage your assets</p>
            </div>
          </Link>

          <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm opacity-60 cursor-not-allowed">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Analytics</p>
              <p className="text-sm text-gray-500">Coming soon</p>
            </div>
          </div>

          <Link
            href="/settings"
            className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <Settings className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Settings</p>
              <p className="text-sm text-gray-500">Account preferences</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
