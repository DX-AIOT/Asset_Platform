'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAdminTransactions, resolveAdminTransaction } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';
import { useToast } from '@/contexts/ToastContext';
import { RefreshCw } from 'lucide-react';
import type { AdminTransaction, TransactionStatus } from '@/types/admin';
import type { BadgeProps } from '@/components/ui/badge';

const STATUS_OPTIONS: { label: string; value: TransactionStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Disputed', value: 'DISPUTED' },
  { label: 'Held', value: 'HELD' },
  { label: 'Released', value: 'RELEASED' },
  { label: 'Refunded', value: 'REFUNDED' },
];

const STATUS_BADGE_VARIANT: Record<TransactionStatus, BadgeProps['variant']> = {
  DISPUTED: 'destructive',
  HELD: 'warning',
  RELEASED: 'success',
  REFUNDED: 'secondary',
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  DISPUTED: 'Disputed',
  HELD: 'Held',
  RELEASED: 'Released',
  REFUNDED: 'Refunded',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DisputesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | ''>('DISPUTED');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Role guard — redirect non-admins to 403
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && user.role !== 'admin') {
      router.push('/403');
    }
  }, [authLoading, user, router]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminTransactions(
        statusFilter ? { status: statusFilter } : undefined
      );
      setTransactions(result.transactions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      void fetchTransactions();
    }
  }, [user, fetchTransactions]);

  const handleResolve = async (id: string, resolution: 'buyer' | 'seller') => {
    setResolvingId(id);
    try {
      const updated = await resolveAdminTransaction(id, resolution);
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: updated.status } : t))
      );
      showToast({
        title: 'Dispute resolved',
        description: `Released to ${resolution === 'buyer' ? 'buyer' : 'seller'} successfully.`,
        variant: 'success',
      });
    } catch (err: unknown) {
      showToast({
        title: 'Resolution failed',
        description: err instanceof Error ? err.message : 'Could not resolve dispute.',
        variant: 'error',
      });
    } finally {
      setResolvingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <StateCard variant="loading" title="Loading" description="Checking permissions…" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

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
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                Overview
              </Link>
              <Link href="/dashboard/assets" className="text-sm text-gray-600 hover:text-gray-900">
                Assets
              </Link>
              <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">
                Admin — Disputes
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded-full font-medium">
                Admin
              </span>
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

      {/* Main */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dispute Resolution</h1>
            <p className="mt-1 text-sm text-gray-500">
              {loading
                ? 'Loading transactions…'
                : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-sm text-gray-600 whitespace-nowrap">
                Filter:
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | '')}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchTransactions()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Content */}
        {error ? (
          <StateCard
            variant="error"
            title="Could not load transactions"
            description={error}
            actionLabel="Try again"
            onAction={() => void fetchTransactions()}
          />
        ) : loading ? (
          <StateCard
            variant="loading"
            title="Loading transactions"
            description="Fetching dispute data…"
          />
        ) : transactions.length === 0 ? (
          <StateCard
            variant="empty"
            title="No transactions found"
            description={
              statusFilter
                ? `No ${STATUS_LABELS[statusFilter as TransactionStatus].toLowerCase()} transactions at this time.`
                : 'No transactions match your current filter.'
            }
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Listing
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Buyer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Disputed At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {transactions.map((tx) => {
                    const canResolve = tx.status === 'DISPUTED' || tx.status === 'HELD';
                    const isResolving = resolvingId === tx.id;
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                          {tx.transactionId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[180px] truncate">
                          {tx.listingTitle}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {tx.buyerEmail}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {tx.sellerEmail}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right whitespace-nowrap">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(tx.disputedAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant={STATUS_BADGE_VARIANT[tx.status]}>
                            {STATUS_LABELS[tx.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {canResolve ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isResolving}
                                onClick={() => void handleResolve(tx.id, 'buyer')}
                              >
                                {isResolving ? '…' : 'Release to Buyer'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isResolving}
                                onClick={() => void handleResolve(tx.id, 'seller')}
                              >
                                {isResolving ? '…' : 'Release to Seller'}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
