/**
 * Buckets an array of ISO timestamp strings (or nulls) into a daily count
 * time series covering the last `days` days, including days with zero
 * events, so a chart always shows a continuous line rather than gaps for
 * quiet days. Returns entries in chronological order (oldest first).
 */
export function bucketByDay(
  timestamps: (string | null | undefined)[],
  days: number,
  now: Date = new Date()
): { date: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(5, 10), 0); // MM-DD
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  for (const ts of timestamps) {
    if (!ts) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime()) || d < cutoff) continue;
    const key = d.toISOString().slice(5, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, value]) => ({ date, value }));
}

/**
 * Same bucketing, but sums a numeric amount per day instead of counting
 * events — used for things like "W3TR distributed per day" where each
 * event carries a variable amount rather than counting as 1.
 */
export function bucketAmountByDay(
  events: { timestamp: string | null | undefined; amount: number }[],
  days: number,
  now: Date = new Date()
): { date: string; value: number }[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(5, 10), 0);
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  for (const { timestamp, amount } of events) {
    if (!timestamp) continue;
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime()) || d < cutoff) continue;
    const key = d.toISOString().slice(5, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + amount);
  }

  return Array.from(buckets.entries()).map(([date, value]) => ({ date, value }));
}