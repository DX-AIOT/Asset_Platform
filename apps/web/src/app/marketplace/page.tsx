'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { browseListings } from '@/lib/api';
import type { Listing } from '@/types/listings';
import { LISTING_CONDITION_LABELS } from '@/types/listings';
import { ItemCategory, CATEGORY_LABELS } from '@/types/items';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { Package, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
const PAGE_SIZE = 20;

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function conditionVariant(c: string): 'success' | 'default' | 'warning' {
  if (c === 'new' || c === 'like_new') return 'success';
  if (c === 'poor') return 'warning';
  return 'default';
}

function ListingCard({ listing }: { listing: Listing }) {
  const photo = listing.photos[0];
  const title = listing.title ?? 'Listing';
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
    >
      <div className="relative h-44 bg-gray-100 flex-shrink-0">
        {photo ? (
          <Image src={photo} alt={title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 280px" />
        ) : (
          <div className="h-full flex items-center justify-center">
            <Package className="h-12 w-12 text-gray-300" />
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{title}</p>
        <p className="text-base font-bold text-blue-600">{formatVnd(listing.price)}</p>
        <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
          <Badge variant={conditionVariant(listing.condition)}>
            {LISTING_CONDITION_LABELS[listing.condition]}
          </Badge>
          {listing.city && (
            <span className="text-xs text-gray-500 truncate">{listing.city}</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{timeAgo(listing.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await browseListings({
        q: search || undefined,
        category: category || undefined,
        condition: condition || undefined,
        priceMin: priceMin ? Number(priceMin) : undefined,
        priceMax: priceMax ? Number(priceMax) : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setListings(result.listings);
      setTotal(result.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [search, category, condition, priceMin, priceMax, page]);

  useEffect(() => {
    if (user) fetchListings();
  }, [user, fetchListings]);

  function applySearch() {
    setSearch(pendingSearch);
    setPage(1);
  }

  function clearFilters() {
    setPendingSearch('');
    setSearch('');
    setCategory('');
    setCondition('');
    setPriceMin('');
    setPriceMax('');
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard variant="loading" title="Loading marketplace" description="Fetching active listings." />
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
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Overview</Link>
              <Link href="/dashboard/assets" className="text-sm text-gray-600 hover:text-gray-900">Assets</Link>
              <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">Marketplace</span>
              <Link href="/my-listings" className="text-sm text-gray-600 hover:text-gray-900">My Listings</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Settings</Link>
              <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total > 0 ? `${total} active listing${total !== 1 ? 's' : ''}` : 'Browse listings from other sellers'}
          </p>
        </div>

        {/* Search + filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 space-y-3">
          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search listings…"
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              />
            </div>
            <Button onClick={applySearch}>Search</Button>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                <option value="">All categories</option>
                {Object.values(ItemCategory).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </Select>
            </div>

            <div className="min-w-[120px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
              <Select value={condition} onChange={(e) => { setCondition(e.target.value); setPage(1); }}>
                <option value="">Any condition</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{LISTING_CONDITION_LABELS[c]}</option>
                ))}
              </Select>
            </div>

            <div className="min-w-[110px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Min price (₫)</label>
              <Input
                type="number"
                placeholder="0"
                value={priceMin}
                onChange={(e) => { setPriceMin(e.target.value); setPage(1); }}
              />
            </div>

            <div className="min-w-[110px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Max price (₫)</label>
              <Input
                type="number"
                placeholder="—"
                value={priceMax}
                onChange={(e) => { setPriceMax(e.target.value); setPage(1); }}
              />
            </div>

            {(category || condition || priceMin || priceMax || search) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="self-end">
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {error ? (
          <StateCard
            variant="error"
            title="Could not load listings"
            description={error}
            actionLabel="Try again"
            onAction={() => { void fetchListings(); }}
          />
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <StateCard
            variant="empty"
            title="No listings found"
            description="Try adjusting your filters or search terms."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
