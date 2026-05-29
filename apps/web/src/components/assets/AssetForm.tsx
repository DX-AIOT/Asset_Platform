'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
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

  const handleInputChange =
    (field: keyof CreateItemInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setPhotoError('Please upload a PNG, JPEG, or WEBP image');
      return;
    }

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
          <p className="mt-1 text-sm text-gray-500">
            Upload a photo for AI condition assessment, then review and save the asset details.
          </p>

          {formError && (
            <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="asset-name">
                Name *
              </label>
              <Input id="asset-name" value={form.name ?? ''} onChange={handleInputChange('name')} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="asset-brand">Brand</label>
                <Input id="asset-brand" value={form.brand ?? ''} onChange={handleInputChange('brand')} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="asset-model">Model</label>
                <Input id="asset-model" value={form.model ?? ''} onChange={handleInputChange('model')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="asset-category">Category</label>
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
                <label className="text-sm font-medium text-gray-700" htmlFor="asset-serial">Serial</label>
                <Input id="asset-serial" value={form.serial ?? ''} onChange={handleInputChange('serial')} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="asset-photo">Photo for AI assessment</label>
              <Input id="asset-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} />
              {photoError && <p className="mt-1 text-xs text-red-700">{photoError}</p>}
              {assessing && (
                <p className="mt-2 inline-flex items-center gap-1 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assessing condition...
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="asset-condition">Condition</label>
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
              {assessmentMessage && (
                <div
                  className={`mt-2 rounded-md px-3 py-2 text-sm inline-flex items-start gap-2 ${
                    assessmentLowConfidence
                      ? 'bg-amber-50 border border-amber-300 text-amber-900'
                      : 'bg-green-50 border border-green-300 text-green-800'
                  }`}
                >
                  {assessmentLowConfidence ? (
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{assessmentMessage}</span>
                </div>
              )}
              {assessmentNotes && <p className="mt-2 text-sm text-gray-600">AI notes: {assessmentNotes}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="asset-purchase-date">Purchase date</label>
                <Input id="asset-purchase-date" type="date" value={form.purchaseDate ?? ''} onChange={handleInputChange('purchaseDate')} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="asset-purchase-price">Purchase price</label>
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
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="asset-location">Location</label>
              <Input id="asset-location" value={form.location ?? ''} onChange={handleInputChange('location')} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700" htmlFor="asset-notes">Notes</label>
              <textarea
                id="asset-notes"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                value={form.notes ?? ''}
                onChange={handleInputChange('notes')}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={submitting || assessing}>
                {submitting ? 'Saving...' : mode === 'create' ? 'Create Asset' : 'Save Changes'}
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
