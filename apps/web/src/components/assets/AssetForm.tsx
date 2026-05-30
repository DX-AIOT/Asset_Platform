'use client';

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { assessCondition, createItem, getItem, updateItem } from '@/lib/api';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  CreateItemInput,
  Item,
  ItemCategory,
  ItemCondition,
} from '@/types/items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';

type FormMode = 'create' | 'edit';

interface AssetFormProps {
  mode: FormMode;
  itemId?: string;
}

const CATEGORY_OPTIONS = Object.values(ItemCategory);
const CONDITION_OPTIONS = Object.values(ItemCondition);
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_PHOTOS = 10;

function toFormState(item?: Item): CreateItemInput {
  if (!item) {
    return {
      name: '',
      category: ItemCategory.OTHER,
      condition: ItemCondition.GOOD,
      photos: [],
    };
  }

  return {
    name: item.name,
    brand: item.brand ?? '',
    model: item.model ?? '',
    category: item.category,
    serial: item.serial ?? '',
    purchaseDate: item.purchaseDate ?? '',
    purchasePrice: item.purchasePrice ?? undefined,
    condition: item.condition,
    location: item.location ?? '',
    photos: item.photos ?? [],
    warrantyExpiry: item.warrantyExpiry ?? '',
    notes: item.notes ?? '',
  };
}

function mapAiConditionToItemCondition(condition: string): ItemCondition {
  switch (condition) {
    case 'excellent':
      return ItemCondition.LIKE_NEW;
    case 'good':
      return ItemCondition.GOOD;
    case 'fair':
      return ItemCondition.FAIR;
    default:
      return ItemCondition.POOR;
  }
}

function toBase64WithoutPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

function DateInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <CalendarDays className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
    </div>
  );
}

export function AssetForm({ mode, itemId }: AssetFormProps) {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [loadingItem, setLoadingItem] = useState(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateItemInput>(toFormState());
  const [assessmentMessage, setAssessmentMessage] = useState<string | null>(null);
  const [assessmentLowConfidence, setAssessmentLowConfidence] = useState(false);
  const [assessmentNotes, setAssessmentNotes] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (mode !== 'edit' || !user || !itemId) return;

    setLoadingItem(true);
    setFormError(null);
    getItem(itemId)
      .then((item) => setForm(toFormState(item)))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to load asset';
        setFormError(message);
      })
      .finally(() => setLoadingItem(false));
  }, [mode, user, itemId]);

  const pageTitle = useMemo(() => (mode === 'create' ? 'Add Asset' : 'Edit Asset'), [mode]);
  const photos = form.photos ?? [];

  const handleInputChange =
    (field: keyof CreateItemInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };

  const runAiAssessment = async (file: File) => {
    setPhotoError(null);
    setFormError(null);
    setAssessing(true);
    setAssessmentMessage(null);
    setAssessmentNotes(null);
    setAssessmentLowConfidence(false);

    try {
      const dataUrl = await fileToDataUrl(file);
      const imageBase64 = toBase64WithoutPrefix(dataUrl);
      const result = await assessCondition(imageBase64, file.type, itemId);

      setForm((current) => ({
        ...current,
        photos: [dataUrl, ...(current.photos?.slice(1) ?? [])],
      }));

      setAssessmentNotes(result.notes);
      if (result.fallbackSuggested || result.confidence === 0) {
        setAssessmentLowConfidence(true);
        setAssessmentMessage('AI confidence is low — please set condition manually');
      } else {
        const autoCondition = mapAiConditionToItemCondition(result.condition);
        setForm((current) => ({ ...current, condition: autoCondition }));
        setAssessmentLowConfidence(false);
        setAssessmentMessage(`Condition set from AI (${Math.round(result.confidence * 100)}% confidence)`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to assess condition';
      setPhotoError(message);
    } finally {
      setAssessing(false);
    }
  };

  const handlePrimaryPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setPhotoError('Please upload a PNG, JPEG, or WEBP image');
      return;
    }
    await runAiAssessment(file);
    event.target.value = '';
  };

  const handleAdditionalPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const currentCount = photos.length;
    const allowed = files.slice(0, MAX_PHOTOS - currentCount);

    for (const file of allowed) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) continue;
      const dataUrl = await fileToDataUrl(file);
      setForm((current) => ({
        ...current,
        photos: [...(current.photos ?? []), dataUrl],
      }));
    }
    event.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setForm((current) => ({
      ...current,
      photos: (current.photos ?? []).filter((_, i) => i !== index),
    }));
    if (index === 0) {
      setAssessmentMessage(null);
      setAssessmentNotes(null);
      setAssessmentLowConfidence(false);
    }
  };

  const handleDropZoneClick = () => {
    if (photos.length === 0) {
      primaryInputRef.current?.click();
    } else {
      additionalInputRef.current?.click();
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const validFiles = files.filter((f) => ALLOWED_MIME_TYPES.has(f.type));
    if (validFiles.length === 0) {
      setPhotoError('Please upload PNG, JPEG, or WEBP images');
      return;
    }

    if (photos.length === 0) {
      await runAiAssessment(validFiles[0]);
      for (const file of validFiles.slice(1, MAX_PHOTOS)) {
        const dataUrl = await fileToDataUrl(file);
        setForm((current) => ({
          ...current,
          photos: [...(current.photos ?? []), dataUrl],
        }));
      }
    } else {
      const remaining = MAX_PHOTOS - photos.length;
      for (const file of validFiles.slice(0, remaining)) {
        const dataUrl = await fileToDataUrl(file);
        setForm((current) => ({
          ...current,
          photos: [...(current.photos ?? []), dataUrl],
        }));
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name?.trim()) {
      setFormError('Asset name is required');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload: CreateItemInput = {
      name: form.name.trim(),
      brand: form.brand?.trim() || undefined,
      model: form.model?.trim() || undefined,
      category: form.category,
      serial: form.serial?.trim() || undefined,
      purchaseDate: form.purchaseDate || undefined,
      purchasePrice:
        typeof form.purchasePrice === 'number'
          ? form.purchasePrice
          : form.purchasePrice
            ? Number(form.purchasePrice)
            : undefined,
      condition: form.condition,
      location: form.location?.trim() || undefined,
      photos: form.photos && form.photos.length > 0 ? form.photos : undefined,
      warrantyExpiry: form.warrantyExpiry || undefined,
      notes: form.notes?.trim() || undefined,
    };

    try {
      const savedItem =
        mode === 'create'
          ? await createItem(payload)
          : await updateItem(itemId as string, payload);
      router.push(`/dashboard/assets/${savedItem.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save asset';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingItem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard
            variant="loading"
            title={mode === 'create' ? 'Preparing asset form' : 'Loading asset for editing'}
            description="Please wait a moment."
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
              <Link href="/dashboard/assets" className="text-sm text-gray-600 hover:text-gray-900">
                Assets
              </Link>
            </div>
            <div className="flex items-center gap-3">
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

      <main className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="mt-1 text-sm text-gray-500 mb-6">
            Upload a photo for AI condition assessment, then review and save the asset details.
          </p>

          {formError && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* ── Photos & Condition ── */}
            <section>
              <SectionHeader title="Photos & Condition" />

              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleDropZoneClick}
                onKeyDown={(e) => e.key === 'Enter' && handleDropZoneClick()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-blue-400 bg-blue-50'
                    : photos.length > 0
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
                }`}
              >
                {/* Hidden file inputs */}
                <input
                  ref={primaryInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handlePrimaryPhotoChange}
                />
                <input
                  ref={additionalInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="sr-only"
                  onChange={handleAdditionalPhotos}
                />

                {photos.length === 0 ? (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    {assessing ? (
                      <>
                        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-3" />
                        <p className="text-sm font-medium text-blue-700">Analyzing with AI…</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-10 w-10 text-gray-400 mb-3" />
                        <p className="text-sm font-medium text-gray-700">Click or drag photos here</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPEG, WEBP · up to {MAX_PHOTOS} photos</p>
                        <p className="text-xs text-blue-600 mt-2 font-medium">First photo runs AI condition check</p>
                      </>
                    )}
                  </div>
                ) : (
                  /* Thumbnail grid */
                  <div className="p-3">
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {photos.map((src, index) => (
                        <div key={index} className="relative group aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-gray-200"
                          />
                          {index === 0 && (
                            <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-blue-600 text-white px-1.5 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhoto(index);
                            }}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            aria-label="Remove photo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {photos.length < MAX_PHOTOS && !assessing && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            additionalInputRef.current?.click();
                          }}
                          className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/40 flex items-center justify-center transition-colors"
                          aria-label="Add more photos"
                        >
                          <UploadCloud className="h-5 w-5 text-gray-400" />
                        </button>
                      )}
                    </div>
                    {assessing && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-700 font-medium">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing condition…
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      {photos.length}/{MAX_PHOTOS} photos · Click or drag to add more
                    </p>
                  </div>
                )}
              </div>

              {photoError && <p className="mt-2 text-xs text-red-600">{photoError}</p>}

              {/* AI result */}
              {assessmentMessage && (
                <div
                  className={`mt-3 rounded-lg px-3 py-2.5 text-sm inline-flex items-start gap-2 w-full ${
                    assessmentLowConfidence
                      ? 'bg-amber-50 border border-amber-200 text-amber-900'
                      : 'bg-green-50 border border-green-200 text-green-800'
                  }`}
                >
                  {assessmentLowConfidence ? (
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <span>{assessmentMessage}</span>
                    {assessmentNotes && (
                      <p className="mt-0.5 text-xs opacity-80">Notes: {assessmentNotes}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Condition select */}
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-condition">
                  Condition
                </label>
                <Select
                  id="asset-condition"
                  value={form.condition ?? ItemCondition.GOOD}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, condition: event.target.value as ItemCondition }))
                  }
                >
                  {CONDITION_OPTIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {CONDITION_LABELS[condition]}
                    </option>
                  ))}
                </Select>
              </div>
            </section>

            {/* ── Basic Information ── */}
            <section>
              <SectionHeader title="Basic Information" />
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-name">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input id="asset-name" value={form.name ?? ''} onChange={handleInputChange('name')} required placeholder="e.g. MacBook Pro 16-inch" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-brand">Brand</label>
                    <Input id="asset-brand" value={form.brand ?? ''} onChange={handleInputChange('brand')} placeholder="e.g. Apple" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-model">Model</label>
                    <Input id="asset-model" value={form.model ?? ''} onChange={handleInputChange('model')} placeholder="e.g. A2485" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-category">Category</label>
                    <Select
                      id="asset-category"
                      value={form.category ?? ItemCategory.OTHER}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, category: event.target.value as ItemCategory }))
                      }
                    >
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-serial">Serial number</label>
                    <Input id="asset-serial" value={form.serial ?? ''} onChange={handleInputChange('serial')} placeholder="e.g. C02XG1234HV" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-location">Location</label>
                  <Input id="asset-location" value={form.location ?? ''} onChange={handleInputChange('location')} placeholder="e.g. Office 3B, Server Room" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-notes">Notes</label>
                  <textarea
                    id="asset-notes"
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    value={form.notes ?? ''}
                    onChange={handleInputChange('notes')}
                    placeholder="Additional details about this asset…"
                  />
                </div>
              </div>
            </section>

            {/* ── Purchase Details ── */}
            <section>
              <SectionHeader title="Purchase Details" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-purchase-date">
                      Purchase date
                    </label>
                    <DateInput
                      id="asset-purchase-date"
                      value={form.purchaseDate ?? ''}
                      onChange={handleInputChange('purchaseDate')}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-purchase-price">
                      Purchase price
                    </label>
                    <Input
                      id="asset-purchase-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.purchasePrice ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          purchasePrice: event.target.value === '' ? undefined : Number(event.target.value),
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="asset-warranty-expiry">
                      Warranty expiry
                    </label>
                    <DateInput
                      id="asset-warranty-expiry"
                      value={form.warrantyExpiry ?? ''}
                      onChange={handleInputChange('warrantyExpiry')}
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <Button type="submit" disabled={submitting || assessing}>
                {submitting ? 'Saving…' : mode === 'create' ? 'Create Asset' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/assets')}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
