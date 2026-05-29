'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PriceHistoryResponse, TrendDirection } from '@/types/items';

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div className="h-12 flex items-center text-xs text-gray-400">Not enough data</div>;
  }

  const w = 120;
  const h = 40;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map((v) => pad + (1 - (v - min) / range) * (h - pad * 2));

  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');

  const isUp = points[points.length - 1] >= points[0];
  const stroke = isUp ? '#16a34a' : '#dc2626';

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendBadge({ direction, percent }: { direction: TrendDirection; percent: number | null }) {
  const label = percent !== null ? `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%` : '—';
  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <TrendingUp className="h-3 w-3" />
        {label}
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <TrendingDown className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
      <Minus className="h-3 w-3" />
      {label}
    </span>
  );
}

interface Props {
  data: PriceHistoryResponse;
}

export function PriceHistoryChart({ data }: Props) {
  const { points, trends, latestValue, currency } = data;

  const fmt = (v: number | null) => {
    if (v === null) return '—';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(v);
  };

  const values = points.map((p) => p.estimatedValue);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-6">
        <div>
          <p className="text-xs text-gray-500 mb-1">Estimated market value</p>
          <p className="text-xl font-semibold text-gray-900">{fmt(latestValue)}</p>
        </div>
        <div className="pb-1">
          <Sparkline points={values} />
        </div>
      </div>

      {trends.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {trends.map((t) => (
            <div key={t.windowDays} className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">{t.windowDays}d</span>
              <TrendBadge direction={t.direction} percent={t.percentChange} />
            </div>
          ))}
        </div>
      )}

      {points.length > 0 && (
        <div className="mt-2 max-h-36 overflow-y-auto">
          <table className="w-full text-xs text-gray-700">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left pb-1 font-medium">Date</th>
                <th className="text-right pb-1 font-medium">Value</th>
                <th className="text-right pb-1 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-1">
                    {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(p.recordedAt))}
                  </td>
                  <td className="py-1 text-right">{fmt(p.estimatedValue)}</td>
                  <td className="py-1 text-right capitalize text-gray-400">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
