import type { Incident } from '../types';
import type { Filters } from './filters';
import { inRange } from './filters';
import { isOpen, resolutionHours, slaState } from './sla';

export function applyFilters(list: Incident[], f: Filters) {
  return list.filter((i) =>
    (!f.factory || i.factory === f.factory) && (!f.application || i.application === f.application) &&
    (!f.severity || i.priority === f.severity) && inRange(i.createdAt, f.days));
}

export function countBy<T>(list: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  list.forEach((t) => m.set(key(t), (m.get(key(t)) ?? 0) + 1));
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function slaCompliance(list: Incident[]) {
  // Compliance is measured on incidents that have a conclusive outcome: closed ones, or open ones already breached.
  const decided = list.filter((i) => !isOpen(i) || slaState(i) === 'Breached');
  const ok = decided.filter((i) => slaState(i) === 'Met').length;
  return { ok, total: decided.length, pct: decided.length ? Math.round((ok / decided.length) * 100) : 100 };
}

export function avgResolutionHours(list: Incident[]) {
  const hs = list.map(resolutionHours).filter((h): h is number => h !== undefined);
  return hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : 0;
}

/** Daily buckets (labels dd/mm) for the last N days (N capped to 90 for "all time"). */
export function dailyBuckets(days: number) {
  const n = days === 0 ? 90 : days;
  const out: { key: string; label: string }[] = [];
  for (let d = n - 1; d >= 0; d--) {
    const dt = new Date(Date.now() - d * 86400_000);
    out.push({ key: dt.toISOString().slice(0, 10), label: `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}` });
  }
  return out;
}
