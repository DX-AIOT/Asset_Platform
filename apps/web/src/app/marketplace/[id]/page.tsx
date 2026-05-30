'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getListing } from '@/lib/api';
import type { Listing } from '@/types/listings';
import { LISTING_CONDITION_LABELS } from '@/types/listings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { ArrowLeft, Package, User, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(value));
}

function conditionVariant(c: string): 'success' | 'default' | 'warning' {
  if (c === 'new' || c === 'like_new') return 'success';
  if (c === 'poor') return 'warning';
  return 'default';
}

function PhotoCarousel({ photos, title }: { photos: string[]; title: string }) {
  const [idx, setIdx] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="relative h-80 bg-gray-100 rounded-lg flex items-center justify-center">
        <Package className="h-20 w-20 text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative h-80 bg-gray-100 rounded-lg overflow-hidden">
        <Image
          src={photos[idx]}
          alt={`${title} photo ${idx + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 600px"
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % photos.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/50'}`}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`relative flex-shrink-0 h-16 w-16 rounded-md overflow-hidden border-2 transition-colors ${
                i === idx ? 'border-blue-500' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <Image src={photo} alt={`Thumbnail ${i + 1}`} fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListingDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const fetchListing = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setListing(await getListing(id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load listing');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (user) fetchListing();
  }, [user, fetchListing]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard variant="loading" title="Loading listing" description="Fetching listing details." />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const title = listing?.title ?? 'Listing';

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
              <Link href="/marketplace" className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">Marketplace</Link>
              <Link href="/my-listings" className="text-sm text-gray-600 hover:text-gray-900">My Listings</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Settings</Link>
              <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/marketplace')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Marketplace
          </Button>
        </div>

        {error ? (
          <StateCard
            variant="error"
            title="Could not load this listing"
            description={error}
            actionLabel="Try again"
            onAction={() => { void fetchListing(); }}
          />
        ) : listing ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: photos */}
            <div className="lg:col-span-2">
              <PhotoCarousel photos={listing.photos} title={title} />
            </div>

            {/* Right: info + seller */}
            <div className="space-y-4">
              {/* Price + title */}
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{title}</h1>
                <p className="text-2xl font-bold text-blue-600">{formatVnd(listing.price)}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={conditionVariant(listing.condition)}>
                    {LISTING_CONDITION_LABELS[listing.condition]}
                  </Badge>
                </div>
                {listing.city && (
                  <p className="text-sm text-gray-500">{listing.city}</p>
                )}
                {listing.publishedAt && (
                  <p className="text-xs text-gray-400">Listed {formatDate(listing.publishedAt)}</p>
                )}
              </div>

              {/* Description */}
              {listing.description && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Description</h2>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{listing.description}</p>
                </div>
              )}

              {/* Seller */}
              {listing.seller && (
                <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-gray-700">Seller</h2>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      {listing.seller.avatar ? (
                        <Image
                          src={listing.seller.avatar}
                          alt={listing.seller.name}
                          width={40}
                          height={40}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{listing.seller.name}</p>
                      <p className="text-xs text-gray-500">
                        Member since {formatDate(listing.seller.memberSince)}
                      </p>
                    </div>
                  </div>
                  <Button className="w-full" disabled>
                    <MessageCircle className="h-4 w-4 mr-1.5" />
                    Contact Seller
                    <span className="ml-1 text-xs opacity-70">(Coming soon)</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <StateCard
            variant="empty"
            title="Listing not found"
            description="This listing may have been removed or is no longer available."
            actionLabel="Back to Marketplace"
            onAction={() => router.push('/marketplace')}
          />
        )}
      </main>
    </div>
  );
}
