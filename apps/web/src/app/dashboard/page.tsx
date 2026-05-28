'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMyItems, getMyPortfolioValue } from '@/lib/api';
import { CATEGORY_LABELS, type Item, type ItemCategory } from '@/types/items';
import { AlertTriangle, BarChart3, Clock3, Package, Settings, Wallet } from 'lucide-react';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatShortDate(value: string | null): string {
  if (!value) return 'Unknown date';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

function getDaysUntil(dateString: string): number {
  const now = new Date();
  const then = new Date(dateString);
  const diff = then.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [portfolio, setPortfolio] = useState<{ total: number; depreciated: number }>({
    total: 0,
    depreciated: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsResult, portfolioResult] = await Promise.all([getMyItems(), getMyPortfolioValue()]);
      setItems(itemsResult.items);
      setPortfolio(portfolioResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  const metrics = useMemo(() => {
    const totalAssets = items.length;
    const totalPortfolioValue = portfolio.total;
    const totalDepreciatedValue = portfolio.depreciated;
    const totalDepreciation = Math.max(0, totalPortfolioValue - totalDepreciatedValue);
    return { totalAssets, totalPortfolioValue, totalDepreciatedValue, totalDepreciation };
  }, [items, portfolio]);

  const categoryData = useMemo(() => {
    const counts = new Map<ItemCategory, number>();
    items.forEach((item) => {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count, label: CATEGORY_LABELS[category] }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const locationData = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const location = item.location?.trim() || 'Unspecified';
      counts.set(location, (counts.get(location) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [items]);

  const recentPurchases = useMemo(
    () =>
      [...items]
        .filter((item) => item.purchaseDate)
        .sort(
          (a, b) =>
            new Date(b.purchaseDate ?? 0).getTime() - new Date(a.purchaseDate ?? 0).getTime()
        )
        .slice(0, 6),
    [items]
  );

  const expiringWarranty = useMemo(
    () =>
      [...items]
        .filter((item) => item.warrantyExpiry && getDaysUntil(item.warrantyExpiry) >= 0)
        .sort(
          (a, b) =>
            getDaysUntil(a.warrantyExpiry as string) - getDaysUntil(b.warrantyExpiry as string)
        )
        .slice(0, 6),
    [items]
  );

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

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error:</strong> {error}
            <button onClick={fetchDashboardData} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Tổng số tài sản</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.totalAssets}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Tổng giá trị portfolio</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalPortfolioValue)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Giá trị còn lại</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(metrics.totalDepreciatedValue)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Khấu hao tổng</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{formatCurrency(metrics.totalDepreciation)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Phân bố theo category</h3>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative h-52 w-52 rounded-full bg-gray-100">
                {categoryData.length > 0 ? (
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    {categoryData.reduce(
                      (acc, entry, index) => {
                        const ratio = entry.count / items.length;
                        const sweep = ratio * 100;
                        const start = acc.offset;
                        const end = start + sweep;
                        const color = ['#2563eb', '#0891b2', '#f59e0b', '#7c3aed', '#ef4444', '#10b981', '#6b7280'][index % 7];
                        acc.paths.push(
                          <circle
                            key={entry.category}
                            cx="50"
                            cy="50"
                            r="30"
                            fill="transparent"
                            stroke={color}
                            strokeWidth="20"
                            strokeDasharray={`${sweep} ${100 - sweep}`}
                            strokeDashoffset={-start}
                          />
                        );
                        acc.offset = end;
                        return acc;
                      },
                      { paths: [] as React.ReactNode[], offset: 0 }
                    ).paths}
                  </svg>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">No data</div>
                )}
              </div>
            </div>
            <div>
              <ul className="mt-5 space-y-2">
                {categoryData.map((entry, index) => (
                  <li key={entry.category} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-700">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: ['#2563eb', '#0891b2', '#f59e0b', '#7c3aed', '#ef4444', '#10b981', '#6b7280'][index % 7],
                        }}
                      />
                      {entry.label}
                    </span>
                    <span className="font-medium text-gray-900">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Phân bố theo location</h3>
            <div className="mt-5 space-y-3">
              {locationData.length > 0 ? (
                locationData.map((entry) => {
                  const maxCount = locationData[0]?.count ?? 1;
                  const width = Math.max(8, Math.round((entry.count / maxCount) * 100));
                  return (
                    <div key={entry.location}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-gray-700">{entry.location}</span>
                        <span className="font-medium text-gray-900">{entry.count}</span>
                      </div>
                      <div className="h-2.5 rounded bg-gray-100">
                        <div className="h-2.5 rounded bg-blue-600" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No location data</p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Timeline mua gần đây</h3>
              <Clock3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-4 space-y-3">
              {recentPurchases.length > 0 ? (
                recentPurchases.map((item) => (
                  <div key={item.id} className="rounded-md border border-gray-100 p-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatShortDate(item.purchaseDate)} • {item.location || 'Unspecified'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No purchase history yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Tài sản sắp hết bảo hành</h3>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-4 space-y-3">
              {expiringWarranty.length > 0 ? (
                expiringWarranty.map((item) => {
                  const daysLeft = getDaysUntil(item.warrantyExpiry as string);
                  return (
                    <div key={item.id} className="rounded-md border border-amber-100 bg-amber-50 p-3">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-amber-800">
                        Hết hạn: {formatShortDate(item.warrantyExpiry)} ({daysLeft} days left)
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No active warranties nearing expiry.</p>
              )}
            </div>
          </section>
        </div>

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

          <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Portfolio Health</p>
              <p className="text-sm text-gray-500">
                {items.length > 0 ? `${Math.round((metrics.totalDepreciatedValue / Math.max(metrics.totalPortfolioValue, 1)) * 100)}% value retained` : 'No assets yet'}
              </p>
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

        {isLoading && <p className="mt-4 text-sm text-gray-500">Refreshing dashboard data...</p>}
      </main>
    </div>
  );
}
