'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMyAssets, getMyAssetsValue, type Asset, type AssetValue } from '@/lib/api';

const conditionColors: Record<string, string> = {
  like_new: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-red-100 text-red-800',
};

const categoryIcons: Record<string, string> = {
  mobile_phones: '📱',
  laptops: '💻',
  vehicles: '🏍️',
  electronics: '🔌',
  furniture: '🪑',
  jewelry: '💍',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [value, setValue] = useState<AssetValue | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoadingData(true);
      const [assetsData, valueData] = await Promise.all([
        getMyAssets(),
        getMyAssetsValue(),
      ]);
      setAssets(assetsData);
      setValue(valueData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">⚙️ AIoT Asset Platform</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{user.email}</span>
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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.firstName || user.email}!
          </h2>
          <p className="text-gray-500 mt-1">Here&apos;s your asset portfolio overview.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
            <button onClick={loadDashboardData} className="mt-2 text-red-600 underline text-sm">
              Retry
            </button>
          </div>
        )}

        {value && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm font-medium text-gray-500">Total Assets</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{assets.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm font-medium text-gray-500">Purchase Value</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {formatCurrency(value.totalPurchaseValue)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm font-medium text-gray-500">Current Value</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {formatCurrency(value.totalCurrentValue)}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">My Assets</h3>
            <span className="text-sm text-gray-500">
              {assets.length} item{assets.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loadingData ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3" />
              <p>Loading your assets...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-lg font-medium">No assets yet</p>
              <p className="text-sm mt-1">Start tracking your belongings by adding your first asset.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {assets.map((asset) => (
                <div key={asset.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl mt-1">
                        {categoryIcons[asset.category] || '📦'}
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900">{asset.name}</h4>
                        <p className="text-sm text-gray-500">
                          {asset.brand} · {asset.model} · SN: {asset.serial}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conditionColors[asset.condition] || 'bg-gray-100 text-gray-800'}`}>
                            {asset.condition.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-400">📍 {asset.location}</span>
                          {asset.warrantyExpiry && (
                            <span className="text-xs text-gray-400">
                              🛡️ Warranty until {formatDate(asset.warrantyExpiry)}
                            </span>
                          )}
                        </div>
                        {asset.notes && (
                          <p className="text-xs text-gray-400 mt-1 max-w-lg truncate">{asset.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(asset.depreciatedValue)}
                      </p>
                      <p className="text-xs text-gray-400 line-through">
                        {formatCurrency(asset.purchasePrice)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Bought {formatDate(asset.purchaseDate)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
