import { useFilters, DEFAULT_FILTERS } from '../lib/filters';
import { APPLICATIONS, FACTORIES, SEVERITIES } from '../data/reference';
import { Select } from './ui';

export function FilterBar({ showSeverity = true }: { showSeverity?: boolean }) {
  const { filters: f, setFilters } = useFilters();
  const set = (p: Partial<typeof f>) => setFilters({ ...f, ...p });
  const dirty = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);
  return (
    <div className="card mb-5 grid grid-cols-2 gap-2 p-3 md:grid-cols-3 xl:grid-cols-5">
      <Select label="Factory" value={f.factory} onChange={(v) => set({ factory: v })} options={FACTORIES} placeholder="All factories" />
      <Select label="Application" value={f.application} onChange={(v) => set({ application: v })} options={APPLICATIONS} placeholder="All applications" />
      {showSeverity && <Select label="Severity" value={f.severity} onChange={(v) => set({ severity: v as typeof f.severity })} options={SEVERITIES} placeholder="All severities" />}
      <select aria-label="Date range" className="input" value={f.days} onChange={(e) => set({ days: Number(e.target.value) })}>
        <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={0}>All time</option>
      </select>
      <button className="btn-secondary" disabled={!dirty} onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button>
    </div>
  );
}
