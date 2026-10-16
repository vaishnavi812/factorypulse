import { useEffect, useMemo, useState, type ReactNode } from 'react';

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

const TONES = {
  red: 'bg-red-50 text-red-700 ring-red-600/20', amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20', purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};
export type Tone = keyof typeof TONES;
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>{children}</span>;
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>{action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-slate-900">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'slate' }: { label: string; value: ReactNode; hint?: string; tone?: 'slate' | 'red' | 'amber' | 'green' | 'blue' }) {
  const bar = { slate: 'bg-slate-300', red: 'bg-red-500', amber: 'bg-amber-500', green: 'bg-emerald-500', blue: 'bg-brand-500' }[tone];
  return (
    <div className="card relative overflow-hidden p-4">
      <span className={cx('absolute inset-y-0 left-0 w-1', bar)} />
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />{label}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
      <div className="mb-1 text-3xl" aria-hidden>📭</div>
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {hint && <div className="max-w-sm text-xs text-slate-500">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto my-6 max-w-lg rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="font-semibold">Something went wrong</div>
      <p className="mt-1">{message}</p>
      {onRetry && <button className="btn-secondary mt-3" onClick={onRetry}>Retry</button>}
    </div>
  );
}

/** Renders loading / error / (optional) empty / content for a useQuery result. */
export function QueryBoundary<T>({ q, children }: { q: { data?: T; error?: string; loading: boolean; reload: () => void }; children: (d: T) => ReactNode }) {
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />;
  if (q.data === undefined) return <Spinner />;
  return <>{children(q.data)}</>;
}

export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Select({ value, onChange, options, placeholder, label }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string; label?: string }) {
  return (
    <select aria-label={label ?? placeholder} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

export interface Column<T> {
  key: string; header: string; render: (row: T) => ReactNode; sort?: (row: T) => string | number; className?: string;
}
export function DataTable<T>({ rows, columns, rowKey, onRowClick, pageSize = 10, empty, rowClass }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; pageSize?: number; empty?: ReactNode; rowClass?: (r: T) => string | undefined;
}) {
  const [sortKey, setSortKey] = useState<string>();
  const [dir, setDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => (f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0) * dir);
  }, [rows, columns, sortKey, dir]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page >= pages) setPage(0); }, [pages, page]);
  if (!rows.length) return <>{empty ?? <EmptyState title="No records" />}</>;
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{columns.map((c) => (
              <th key={c.key} className={cx('whitespace-nowrap px-3 py-2 font-medium', c.className)} aria-sort={sortKey === c.key ? (dir === 1 ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button className="inline-flex items-center gap-1 hover:text-slate-800" onClick={() => { if (sortKey === c.key) setDir((d) => (d === 1 ? -1 : 1)); else { setSortKey(c.key); setDir(1); } }}>
                    {c.header}<span aria-hidden className="text-[10px]">{sortKey === c.key ? (dir === 1 ? '▲' : '▼') : '↕'}</span>
                  </button>
                ) : c.header}
              </th>))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick && (() => onRowClick(r))} tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick && ((e) => e.key === 'Enter' && onRowClick(r))}
                className={cx(onRowClick && 'cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none', rowClass?.(r))}>
                {columns.map((c) => <td key={c.key} className={cx('px-3 py-2.5 align-top', c.className)}>{c.render(r)}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <span>{page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length}</span>
          <div className="flex gap-1">
            <button className="btn-secondary !px-2 !py-1" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="btn-secondary !px-2 !py-1" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
