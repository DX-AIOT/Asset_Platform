'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getItem, getItemPriceHistory } from '@/lib/api';
import type { Item, PriceHistoryResponse } from '@/types/items';
import { CATEGORY_LABELS, CONDITION_LABELS } from '@/types/items';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package } from 'lucide-react';
import { StateCard } from '@/components/ui/state-card';
import { PriceHistoryChart } from '@/components/ui/price-history-chart';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="w-40 flex-shrink-0 text-sm font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</span>
    </div>
  );
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(value));
}

export default function AssetDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    setLoading(true);
    setError(null);
    Promise.all([getItem(id), getItemPriceHistory(id).catch(() => null)])
      .then(([fetchedItem, history]) => {
        setItem(fetchedItem);
        setPriceHistory(history);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load asset'))
      .finally(() => setLoading(false));
  }, [user, id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard
            variant="loading"
            title="Loading asset details"
            description="Preparing item profile and valuation data."
          />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                AIoT Asset Platform
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
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

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Assets
          </Button>
        </div>

        {error ? (
          <StateCard
            variant="error"
            title="Could not load this asset"
            description={error}
            actionLabel="Try again"
            onAction={() => router.refresh()}
          />
        ) : item ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start gap-4">
                {item.photos?.[0] ? (
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200">
                    <Image
                      src={item.photos[0]}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                    <Package className="h-10 w-10 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">{item.name}</h1>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{CATEGORY_LABELS[item.category]}</Badge>
                    <Badge variant={item.condition === 'new' || item.condition === 'like_new' ? 'success' : 'default'}>
                      {CONDITION_LABELS[item.condition]}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-0">
              <DetailRow label="Brand" value={item.brand} />
              <DetailRow label="Model" value={item.model} />
              <DetailRow label="Serial Number" value={item.serial} />
              <DetailRow label="Category" value={CATEGORY_LABELS[item.category]} />
              <DetailRow label="Condition" value={CONDITION_LABELS[item.condition]} />
              <DetailRow label="Purchase Price" value={formatCurrency(item.purchasePrice)} />
              <DetailRow label="Purchase Date" value={formatDate(item.purchaseDate)} />
              <DetailRow label="Depreciated Value" value={formatCurrency(item.depreciatedValue)} />
              <DetailRow label="Location" value={item.location} />
              <DetailRow label="Warranty Expiry" value={formatDate(item.warrantyExpiry)} />
              {item.notes && <DetailRow label="Notes" value={<span className="whitespace-pre-wrap">{item.notes}</span>} />}
            </div>

            {/* Price History */}
            {priceHistory && (
              <div className="p-6 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Market Value History</h3>
                <PriceHistoryChart data={priceHistory} />
              </div>
            )}

            {/* Photos */}
            {item.photos && item.photos.length > 1 && (
              <div className="px-6 pb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Photos</h3>
                <div className="grid grid-cols-4 gap-2">
                  {item.photos.map((photo, i) => (
                    <div key={i} className="relative h-20 overflow-hidden rounded-md border border-gray-200">
                      <Image
                        src={photo}
                        alt={`${item.name} photo ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <StateCard
            variant="empty"
            title="Asset not found"
            description="This item may have been deleted or is no longer accessible."
            actionLabel="Back to Assets"
            onAction={() => router.push('/dashboard/assets')}
          />
        )}
      </main>
    </div>
  );
}
