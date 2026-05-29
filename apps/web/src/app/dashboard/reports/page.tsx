'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getInsuranceReportPdf, getMyItems, getMyPortfolioValue } from '@/lib/api';
import { CATEGORY_LABELS, type ItemCategory } from '@/types/items';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { useToast } from '@/contexts/ToastContext';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Reports page focused on insurance PDF generation.
 * Empty `selectedCategories` means "all categories" by API contract.
 */
export default function ReportsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [availableCategories, setAvailableCategories] = useState<ItemCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ItemCategory[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const fetchMetadata = useCallback(async () => {
    setIsLoadingMetadata(true);
    setError(null);
    try {
      const [itemsResult, valueResult] = await Promise.all([getMyItems(), getMyPortfolioValue()]);
      const uniqueCategories = Array.from(new Set(itemsResult.items.map((item) => item.category)));
      setAvailableCategories(uniqueCategories);
      setPortfolioValue(valueResult.depreciated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report metadata');
    } finally {
      setIsLoadingMetadata(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void fetchMetadata();
    }
  }, [user, fetchMetadata]);

  const isAllCategories = selectedCategories.length === 0;
  const selectedSummary = useMemo(() => {
    if (isAllCategories) return 'All categories';
    return selectedCategories.map((category) => CATEGORY_LABELS[category]).join(', ');
  }, [isAllCategories, selectedCategories]);

  const handleToggleCategory = (category: ItemCategory): void => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  };

  /**
   * Requests a PDF blob from the API then triggers a browser download.
   * Keeps generation state local to avoid blocking other page interactions.
   */
  const handleGeneratePdf = async (): Promise<void> => {
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await getInsuranceReportPdf(selectedCategories);
      const filename = `insurance-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(blob, filename);
      setLastGeneratedAt(new Date());
      showToast({
        variant: 'success',
        title: 'Report downloaded',
        description: `Saved as ${filename}.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate insurance report';
      setError(message);
      showToast({
        variant: 'error',
        title: 'Report generation failed',
        description: message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard
            variant="loading"
            title="Preparing reports"
            description="Checking your session and loading report tools."
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
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Overview</Link>
              <Link href="/dashboard/assets" className="text-sm text-gray-600 hover:text-gray-900">Assets</Link>
              <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">Reports</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Settings</Link>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <FileText className="h-4 w-4" />
                Insurance Report
              </div>
              <p className="text-sm text-gray-600">Estimated portfolio value: <strong>{formatCurrency(portfolioValue)}</strong></p>
              <p className="text-sm text-gray-600">Last generated: {lastGeneratedAt ? formatDateTime(lastGeneratedAt) : 'Not generated yet'}</p>
            </div>
            <Button onClick={handleGeneratePdf} disabled={isGenerating}>
              {isGenerating ? 'Generating PDF...' : 'Generate PDF'}
              {!isGenerating && <Download className="ml-2 h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium text-gray-800 mb-2">Category filter (optional)</p>
            {isLoadingMetadata ? (
              <StateCard
                variant="loading"
                title="Loading report metadata"
                description="Fetching categories and current portfolio value."
              />
            ) : availableCategories.length === 0 ? (
              <StateCard
                variant="empty"
                title="No reportable assets yet"
                description="Add at least one asset in your inventory before generating filtered reports."
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((category) => {
                    const selected = selectedCategories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleToggleCategory(category)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          selected
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {CATEGORY_LABELS[category]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">Using: {selectedSummary}</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4">
              <StateCard
                variant="error"
                title="Report action failed"
                description={error}
                actionLabel="Retry metadata load"
                onAction={() => {
                  void fetchMetadata();
                }}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
