'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMyItems } from '@/lib/api';
import { AssetTable } from '@/components/assets/AssetTable';
import type { Item } from '@/types/items';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { StateCard } from '@/components/ui/state-card';

export default function AssetsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyItems();
      setItems(result.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchItems();
  }, [user, fetchItems]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard
            variant="loading"
            title="Loading your assets"
            description="We are fetching your latest inventory."
          />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                AIoT Asset Platform
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Overview
              </Link>
              <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">
                Assets
              </span>
              <Link
                href="/dashboard/reports"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Reports
              </Link>
            </div>
            <div className="flex items-center gap-3">
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

      {/* Main */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
            <p className="mt-1 text-sm text-gray-500">
              {items.length > 0 ? `${items.length} total assets` : 'Your asset inventory'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Asset
            </Button>
          </div>
        </div>

        {error ? (
          <StateCard
            variant="error"
            title="Could not load assets"
            description={error}
            actionLabel="Try again"
            onAction={() => {
              void fetchItems();
            }}
          />
        ) : (
          <AssetTable items={items} loading={loading} />
        )}
      </main>
    </div>
  );
}
