'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  getListingAutofill,
  suggestListingPrice,
  createListing,
  publishListing,
} from '@/lib/api';
import type { ListingAutofillDraft, ListingCondition, ListingPriceSuggestion } from '@/types/listings';
import { LISTING_CONDITION_LABELS } from '@/types/listings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StateCard } from '@/components/ui/state-card';
import { useToast } from '@/contexts/ToastContext';
import { ArrowLeft, TrendingUp, Loader2, Package, CheckCircle } from 'lucide-react';

type Step = 'loading' | 'form' | 'price' | 'location' | 'done';

const CONDITIONS: ListingCondition[] = ['new', 'like_new', 'good', 'fair', 'poor'];

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  if (c === 'high') return 'text-green-600';
  if (c === 'medium') return 'text-yellow-600';
  return 'text-red-600';
}

function confidenceBadge(c: 'high' | 'medium' | 'low'): 'success' | 'warning' | 'destructive' {
  if (c === 'high') return 'success';
  if (c === 'medium') return 'warning';
  return 'destructive';
}

function PriceWidget({
  suggestion,
  price,
  onPriceChange,
}: {
  suggestion: ListingPriceSuggestion;
  price: string;
  onPriceChange: (v: string) => void;
}) {
  const pct = suggestion.suggestedPrice > 0
    ? Math.round(((Number(price) - suggestion.suggestedPrice) / suggestion.suggestedPrice) * 100)
    : 0;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <h3 className="text-sm font-semibold text-blue-900">AI Price Suggestion</h3>
        <Badge variant={confidenceBadge(suggestion.confidence)} className="ml-auto">
          {suggestion.confidence} confidence
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white rounded-md p-2 border border-blue-100">
          <p className="text-xs text-gray-500 mb-0.5">Range low</p>
          <p className="text-sm font-semibold text-gray-700">{formatVnd(suggestion.priceRange.low)}</p>
        </div>
        <div className="bg-white rounded-md p-2 border border-blue-300 ring-1 ring-blue-300">
          <p className="text-xs text-blue-600 mb-0.5 font-medium">Suggested</p>
          <p className={`text-sm font-bold ${confidenceColor(suggestion.confidence)}`}>
            {formatVnd(suggestion.suggestedPrice)}
          </p>
        </div>
        <div className="bg-white rounded-md p-2 border border-blue-100">
          <p className="text-xs text-gray-500 mb-0.5">Range high</p>
          <p className="text-sm font-semibold text-gray-700">{formatVnd(suggestion.priceRange.high)}</p>
        </div>
      </div>

      <p className="text-xs text-blue-700 leading-relaxed">{suggestion.rationale}</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your price (₫){' '}
          {price && Number(price) > 0 && pct !== 0 && (
            <span className={`text-xs ml-1 ${pct > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {pct > 0 ? `+${pct}%` : `${pct}%`} vs suggested
            </span>
          )}
        </label>
        <Input
          type="number"
          min={0}
          value={price}
          onChange={(e) => onPriceChange(e.target.value)}
          placeholder={String(suggestion.suggestedPrice)}
        />
      </div>

      {price && Number(price) > 0 && (
        <button
          type="button"
          className="text-xs text-blue-600 underline hover:no-underline"
          onClick={() => onPriceChange(String(suggestion.suggestedPrice))}
        >
          Use suggested price
        </button>
      )}
    </div>
  );
}

export default function SellAssetPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { id: itemId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('loading');
  const [draft, setDraft] = useState<ListingAutofillDraft | null>(null);
  const [priceSuggestion, setPriceSuggestion] = useState<ListingPriceSuggestion | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<ListingCondition>('good');
  const [photos, setPhotos] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const loadAutofill = useCallback(async () => {
    if (!itemId) return;
    setLoadError(null);
    try {
      const data = await getListingAutofill(itemId);
      setDraft(data);
      setTitle(data.title);
      setDescription(data.description);
      setCondition(data.condition);
      setPhotos(data.photos);
      setCity(data.location.city ?? '');
      setStep('form');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load asset details');
    }
  }, [itemId]);

  useEffect(() => {
    if (user && itemId) loadAutofill();
  }, [user, itemId, loadAutofill]);

  async function fetchPriceSuggestion() {
    setFetchingPrice(true);
    try {
      const suggestion = await suggestListingPrice({ itemId, condition });
      setPriceSuggestion(suggestion);
      if (!price) setPrice(String(suggestion.suggestedPrice));
    } catch {
      showToast({ variant: 'error', title: 'Could not load price suggestion' });
    } finally {
      setFetchingPrice(false);
    }
  }

  function goToPrice() {
    if (!title.trim()) { showToast({ variant: 'error', title: 'Title is required' }); return; }
    if (!price || Number(price) <= 0) { showToast({ variant: 'error', title: 'Enter a valid price' }); return; }
    setStep('price');
    if (!priceSuggestion) void fetchPriceSuggestion();
  }

  function goToLocation() {
    setStep('location');
  }

  async function handleSave(publish: boolean) {
    if (!price || Number(price) <= 0) { showToast({ variant: 'error', title: 'Enter a valid price' }); return; }
    setSaving(true);
    try {
      const listing = await createListing({
        itemId,
        title,
        price: Number(price),
        currency: 'VND',
        condition,
        description: description || undefined,
        photos: photos.length > 0 ? photos : undefined,
        location: city ? { city } : undefined,
      });

      if (publish) {
        await publishListing(listing.id);
        showToast({ variant: 'success', title: 'Listing published!' });
      } else {
        showToast({ variant: 'success', title: 'Listing saved as draft' });
      }

      setCreatedListingId(listing.id);
      setStep('done');
    } catch (err: unknown) {
      showToast({ variant: 'error', title: err instanceof Error ? err.message : 'Failed to create listing' });
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard variant="loading" title="Loading" description="Preparing sell flow." />
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
              <Link href="/dashboard/assets" className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">Assets</Link>
              <Link href="/marketplace" className="text-sm text-gray-600 hover:text-gray-900">Marketplace</Link>
              <Link href="/my-listings" className="text-sm text-gray-600 hover:text-gray-900">My Listings</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Settings</Link>
              <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/assets')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Assets
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Sell This Asset</h1>
            {step !== 'loading' && step !== 'done' && (
              <div className="flex items-center gap-1.5 mt-2">
                {(['form', 'price', 'location'] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        step === s
                          ? 'bg-blue-600'
                          : ['form', 'price', 'location'].indexOf(step) > i
                          ? 'bg-green-500'
                          : 'bg-gray-200'
                      }`}
                    />
                    {i < 2 && <div className="h-px w-4 bg-gray-200" />}
                  </div>
                ))}
                <span className="text-xs text-gray-500 ml-2">
                  {step === 'form' ? 'Step 1: Review listing' : step === 'price' ? 'Step 2: Set price' : 'Step 3: Location & publish'}
                </span>
              </div>
            )}
          </div>

          <div className="p-5">
            {/* Loading autofill */}
            {step === 'loading' && !loadError && (
              <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm">Fetching asset details…</p>
              </div>
            )}

            {step === 'loading' && loadError && (
              <StateCard
                variant="error"
                title="Could not load asset"
                description={loadError}
                actionLabel="Try again"
                onAction={() => { void loadAutofill(); }}
              />
            )}

            {/* Step 1: Review & edit form */}
            {step === 'form' && (
              <div className="space-y-4">
                {/* Photo preview */}
                {photos.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {photos.map((photo, i) => (
                        <div key={i} className="relative h-20 w-20 flex-shrink-0 rounded-md overflow-hidden border border-gray-200">
                          <Image src={photo} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="80px" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {photos.length === 0 && (
                  <div className="h-20 rounded-md bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                    <div className="text-center">
                      <Package className="h-6 w-6 text-gray-300 mx-auto" />
                      <p className="text-xs text-gray-400 mt-1">No photos from asset</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Listing title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. iPhone 13 Pro Max 256GB"
                    maxLength={120}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the item…"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <Select value={condition} onChange={(e) => setCondition(e.target.value as ListingCondition)}>
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>{LISTING_CONDITION_LABELS[c]}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₫) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Enter asking price"
                  />
                  <p className="mt-1 text-xs text-gray-400">Get AI price suggestion in the next step.</p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={goToPrice} disabled={!title.trim()}>
                    Next: Set Price
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: AI Price Widget */}
            {step === 'price' && (
              <div className="space-y-4">
                {fetchingPrice ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <p className="text-sm">Generating price suggestion…</p>
                  </div>
                ) : priceSuggestion ? (
                  <PriceWidget
                    suggestion={priceSuggestion}
                    price={price}
                    onPriceChange={setPrice}
                  />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your price (₫)</label>
                      <Input
                        type="number"
                        min={0}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="Enter asking price"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void fetchPriceSuggestion()}>
                      <TrendingUp className="h-4 w-4 mr-1.5" />
                      Get AI Price Suggestion
                    </Button>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep('form')}>Back</Button>
                  <Button onClick={goToLocation} disabled={!price || Number(price) <= 0}>
                    Next: Location
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Location + publish */}
            {step === 'location' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City / District</label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Hanoi, Ho Chi Minh City"
                  />
                  <p className="mt-1 text-xs text-gray-400">Only city is shown to buyers — exact address is never shared.</p>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-md border border-gray-200 p-4 space-y-2 text-sm">
                  <p className="font-medium text-gray-700">Listing summary</p>
                  <div className="flex justify-between text-gray-600">
                    <span>Title</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">{title}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Condition</span>
                    <span className="font-medium text-gray-900">{LISTING_CONDITION_LABELS[condition]}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Price</span>
                    <span className="font-medium text-blue-600">{price ? formatVnd(Number(price)) : '—'}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Location</span>
                    <span className="font-medium text-gray-900">{city || '—'}</span>
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep('price')}>Back</Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSave(false)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                      Save as Draft
                    </Button>
                    <Button
                      onClick={() => handleSave(true)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                      Publish Now
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Done */}
            {step === 'done' && (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <CheckCircle className="h-14 w-14 text-green-500" />
                <div>
                  <p className="text-lg font-semibold text-gray-900">Listing created!</p>
                  <p className="text-sm text-gray-500 mt-1">Your listing has been saved.</p>
                </div>
                <div className="flex gap-3">
                  {createdListingId && (
                    <Button variant="outline" onClick={() => router.push(`/marketplace/${createdListingId}`)}>
                      View Listing
                    </Button>
                  )}
                  <Button onClick={() => router.push('/my-listings')}>
                    My Listings
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
