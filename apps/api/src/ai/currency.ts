/**
 * Currency conversion helpers for the listing assistant.
 *
 * The valuation engine (DXS-62) works in USD — its comparable corpus stores
 * MSRP-style "new" prices in USD. The marketplace, however, lists in VND, so
 * listing prices are converted USD↔VND with a configurable reference rate.
 *
 * The rate is intentionally a single tunable constant rather than a live FX
 * feed: valuations are coarse resale estimates, so a slowly-drifting reference
 * rate is sufficient and keeps the endpoint deterministic and offline-friendly.
 * Override via the USD_TO_VND_RATE env var when a fresher rate is needed.
 */

/** Reference USD→VND rate used when USD_TO_VND_RATE is not configured. */
export const DEFAULT_USD_TO_VND_RATE = 25000;

/** Round a VND amount to a clean, listing-friendly value. */
export function roundVnd(amount: number, step = 10000): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return Math.max(step, Math.round(amount / step) * step);
}

/** Convert USD → VND and round to the nearest `step` (default 10,000 VND). */
export function usdToVnd(usd: number, rate: number, step = 10000): number {
  return roundVnd(usd * rate, step);
}

/** Convert VND → USD (unrounded; used as a valuation anchor). */
export function vndToUsd(vnd: number, rate: number): number {
  if (rate <= 0) {
    return 0;
  }
  return vnd / rate;
}
