import { createContext, useContext } from 'react';
import type { Severity } from '../types';

export interface Filters { factory: string; application: string; severity: '' | Severity; days: number }
export const DEFAULT_FILTERS: Filters = { factory: '', application: '', severity: '', days: 30 };
export const FilterCtx = createContext<{ filters: Filters; setFilters: (f: Filters) => void }>({
  filters: DEFAULT_FILTERS, setFilters: () => {},
});
export const useFilters = () => useContext(FilterCtx);

export function inRange(iso: string, days: number) {
  return days === 0 || Date.now() - new Date(iso).getTime() <= days * 86400_000;
}
