'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMyListings, publishListing, unpublishListing, deleteListing } from '@/lib/api';
import type { Listing, ListingStatus } from '@/types/listings';
import { LISTING_STATUS_LABELS } from '@/types/listings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { useToast } from '@/contexts/ToastContext';
import { RefreshCw, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'active' | 'draft' | 'expired';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'expired', label: 'Expired' },
];

function statusVariant(status: ListingStatus): 'success' | 'default' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'active': return 'success';
    case 'draft': return 'default';
    case 'expired': return 'warning';
    case 'inactive': return 'secondary';
    default: return 'secondary';
  }
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

function DeleteDialog({
  title,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Delete listing?</h2>
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <span className="font-medium">&quot;{title}&quot;</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MyListingsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyListings();
      setListings(result.listings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchListings();
  }, [user, fetchListings]);

  const filtered = listings.filter((l) => {
    if (tab === 'all') return true;
    if (tab === 'active') return l.status === 'active';
    if (tab === 'draft') return l.status === 'draft' || l.status === 'inactive';
    if (tab === 'expired') return l.status === 'expired';
    return true;
  });

  async function handlePublish(listing: Listing) {
    setActionLoading(listing.id);
    try {
      const updated = await publishListing(listing.id);
      setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      showToast({ variant: 'success', title: 'Listing published' });
    } catch (err: unknown) {
      showToast({ variant: 'error', title: err instanceof Error ? err.message : 'Failed to publish' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnpublish(listing: Listing) {
    setActionLoading(listing.id);
    try {
      const updated = await unpublishListing(listing.id);
      setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      showToast({ variant: 'success', title: 'Listing unpublished' });
    } catch (err: unknown) {
      showToast({ variant: 'error', title: err instanceof Error ? err.message : 'Failed to unpublish' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(listing: Listing) {
    setActionLoading(listing.id);
    try {
      await deleteListing(listing.id);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      showToast({ variant: 'success', title: 'Listing deleted' });
    } catch (err: unknown) {
      showToast({ variant: 'error', title: err instanceof Error ? err.message : 'Failed to delete' });
    } finally {
      setActionLoading(null);
      setDeleteTarget(null);
    }
  }

  const tabCounts: Record<Tab, number> = {
    all: listings.length,
    active: listings.filter((l) => l.status === 'active').length,
    draft: listings.filter((l) => l.status === 'draft' || l.status === 'inactive').length,
    expired: listings.filter((l) => l.status === 'expired').length,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard variant="loading" title="Loading your listings" description="Fetching your marketplace listings." />
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
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">AIoT Asset Platform</Link>
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Overview</Link>
              <Link href="/dashboard/assets" className="text-sm text-gray-600 hover:text-gray-900">Assets</Link>
              <Link href="/marketplace" className="text-sm text-gray-600 hover:text-gray-900">Marketplace</Link>
              <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">My Listings</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Settings</Link>
              <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
            <p className="mt-1 text-sm text-gray-500">
              {listings.length > 0 ? `${listings.length} listing${listings.length !== 1 ? 's' : ''}` : 'Manage your marketplace listings'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchListings} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => router.push('/dashboard/assets')}>
              <Plus className="h-4 w-4 mr-1.5" />
              Sell an Asset
            </Button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="border-b border-gray-200 mb-4">
          <div className="flex gap-0 -mb-px">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  tab === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {label}
                {tabCounts[key] > 0 && (
                  <span className={cn(
                    'ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium',
                    tab === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  )}>
                    {tabCounts[key]}
                  </span>
                )}
              </button>
            ))}
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
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 h-16 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <StateCard
            variant="empty"
            title={tab === 'all' ? "No listings yet" : `No ${tab} listings`}
            description={tab === 'all' ? "Go to your assets and click 'Sell' to create a listing." : `You have no ${tab} listings.`}
            actionLabel={tab === 'all' ? "Browse Assets" : undefined}
            onAction={tab === 'all' ? () => router.push('/dashboard/assets') : undefined}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span>Title</span>
              <span className="text-center min-w-[80px]">Status</span>
              <span className="text-right min-w-[120px]">Price</span>
              <span className="text-right min-w-[100px]">Created</span>
              <span className="text-right min-w-[160px]">Actions</span>
            </div>

            <div className="divide-y divide-gray-100">
              {filtered.map((listing) => {
                const isBusy = actionLoading === listing.id;
                const isActive = listing.status === 'active';
                const canPublish = listing.status === 'draft' || listing.status === 'inactive' || listing.status === 'expired';
                const listingTitle = listing.title ?? 'Untitled Listing';

                return (
                  <div
                    key={listing.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 sm:gap-4 px-4 py-3 items-center hover:bg-gray-50 transition-colors"
                  >
                    {/* Title */}
                    <Link
                      href={`/marketplace/${listing.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate"
                    >
                      {listingTitle}
                    </Link>

                    {/* Status */}
                    <div className="flex sm:justify-center">
                      <Badge variant={statusVariant(listing.status)}>
                        {LISTING_STATUS_LABELS[listing.status]}
                      </Badge>
                    </div>

                    {/* Price */}
                    <span className="text-sm text-gray-700 sm:text-right font-medium">
                      {formatVnd(listing.price)}
                    </span>

                    {/* Date */}
                    <span className="text-xs text-gray-500 sm:text-right">
                      {formatDate(listing.createdAt)}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 sm:justify-end flex-wrap">
                      {canPublish && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePublish(listing)}
                          disabled={isBusy}
                          title="Publish"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Publish
                        </Button>
                      )}
                      {isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnpublish(listing)}
                          disabled={isBusy}
                          title="Unpublish"
                        >
                          <EyeOff className="h-3.5 w-3.5 mr-1" />
                          Unpublish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/marketplace/${listing.id}`)}
                        title="View"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(listing)}
                        disabled={isBusy}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <DeleteDialog
          title={deleteTarget.title ?? 'this listing'}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          loading={actionLoading === deleteTarget.id}
        />
      )}
    </div>
  );
}
