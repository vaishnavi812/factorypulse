import { useMemo, useState } from 'react';
import { services } from '../services';
import { useQuery } from '../lib/useQuery';
import { FACTORIES } from '../data/reference';
import { fmtDateTime, fmtMinutes, pct, relTime } from '../lib/format';
import type { ProductionOrder } from '../types';
import { Badge, Card, DataTable, EmptyState, PageHeader, QueryBoundary, Select, StatCard, type Column } from '../components/ui';
import { OrderBadge, SeverityBadge, WcBadge } from '../components/Badges';

/** An in-progress order is delayed when output lags elapsed time by more than 15 points. */
export function isDelayed(o: ProductionOrder, now = Date.now()) {
  if (o.status !== 'In Progress') return false;
  const s = new Date(o.start).getTime(), e = new Date(o.plannedEnd).getTime();
  const elapsed = Math.min(1, Math.max(0, (now - s) / (e - s)));
  return o.produced / o.planned < elapsed - 0.15;
}

export default function Production() {
  const [factory, setFactory] = useState('');
  const q = useQuery(async () => {
    const [orders, wcs, alerts] = await Promise.all([services.production.listOrders(), services.production.listWorkCenters(), services.production.listAlerts()]);
    return { orders, wcs, alerts };
  });
  const columns: Column<ProductionOrder>[] = useMemo(() => [
    { key: 'id', header: 'Order', render: (o) => <span className="font-medium">{o.id}</span>, sort: (o) => o.id },
    { key: 'f', header: 'Factory', render: (o) => o.factory, sort: (o) => o.factory },
    { key: 'wc', header: 'Work center', render: (o) => o.workCenter, sort: (o) => o.workCenter },
    { key: 'p', header: 'Product', render: (o) => o.product },
    { key: 'q', header: 'Produced / planned', sort: (o) => o.produced / o.planned, render: (o) => (
      <div className="min-w-[140px]"><div className="text-xs tabular-nums">{o.produced} / {o.planned} <span className="text-slate-400">({pct(o.produced, o.planned)}%)</span></div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={`h-1.5 rounded-full ${o.status === 'Blocked' ? 'bg-red-500' : isDelayed(o) ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, pct(o.produced, o.planned))}%` }} /></div></div>) },
    { key: 's', header: 'Status', sort: (o) => o.status, render: (o) => (
      <div className="flex flex-col items-start gap-1"><OrderBadge s={o.status} />{isDelayed(o) && <Badge tone="amber">⏱ Delayed</Badge>}</div>) },
    { key: 'd', header: 'Downtime', sort: (o) => o.downtimeMin, render: (o) => <span className={o.downtimeMin >= 120 ? 'font-medium text-red-600' : ''}>{fmtMinutes(o.downtimeMin)}</span> },
    { key: 'e', header: 'Planned end', sort: (o) => o.plannedEnd, render: (o) => <span className="whitespace-nowrap">{fmtDateTime(o.plannedEnd)}</span> },
  ], []);

  return (
    <>
      <PageHeader title="Production Overview" subtitle="Sample production orders, work center status and reported downtime"
        actions={<div className="w-44"><Select label="Factory" value={factory} onChange={setFactory} options={FACTORIES} placeholder="All factories" /></div>} />
      <QueryBoundary q={q}>
        {({ orders, wcs, alerts }) => {
          const o = orders.filter((x) => !factory || x.factory === factory);
          const w = wcs.filter((x) => !factory || x.factory === factory);
          const a = alerts.filter((x) => (!factory || x.factory === factory));
          const open = a.filter((x) => !x.resolved);
          const delayed = o.filter((x) => isDelayed(x));
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="In progress" value={o.filter((x) => x.status === 'In Progress').length} tone="blue" />
                <StatCard label="Blocked orders" value={o.filter((x) => x.status === 'Blocked').length} tone="red" />
                <StatCard label="Delayed" value={delayed.length} tone={delayed.length ? 'amber' : 'green'} hint="output behind schedule" />
                <StatCard label="Reported downtime" value={fmtMinutes(o.reduce((s, x) => s + x.downtimeMin, 0))} tone="slate" hint="across listed orders" />
              </div>
              <Card title="Work centers">
                {w.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {w.map((c) => (
                      <div key={c.id} className={`rounded-lg border p-3 ${c.status === 'Blocked' ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{c.name}</span><WcBadge s={c.status} /></div>
                        <div className="mt-1 text-xs text-slate-500">{c.factory}</div>
                        {c.blockReason && <div className="mt-1.5 text-xs font-medium text-red-700">🚫 {c.blockReason}</div>}
                      </div>))}
                  </div>) : <EmptyState title="No work centers" />}
              </Card>
              <Card title="Production orders">
                <DataTable rows={o} columns={columns} rowKey={(x) => x.id} pageSize={8}
                  rowClass={(x) => (x.status === 'Blocked' ? 'bg-red-50/60' : isDelayed(x) ? 'bg-amber-50/60' : undefined)}
                  empty={<EmptyState title="No orders for this factory" />} />
              </Card>
              <Card title="Factory alerts" action={<span className="text-xs text-slate-500">{open.length} unresolved</span>}>
                {a.length ? (
                  <ul className="divide-y divide-slate-100">
                    {a.sort((x, y) => Number(x.resolved) - Number(y.resolved) || y.raisedAt.localeCompare(x.raisedAt)).map((x) => (
                      <li key={x.id} className={`flex flex-wrap items-center gap-3 py-2 text-sm ${x.resolved ? 'opacity-50' : ''}`}>
                        <SeverityBadge s={x.severity} />
                        <div className="min-w-0 flex-1"><div>{x.message}</div><div className="text-xs text-slate-500">{x.factory} · {x.workCenter} · {relTime(x.raisedAt)}</div></div>
                        {x.resolved ? <Badge tone="green">Resolved</Badge> : <AckButton id={x.id} />}
                      </li>))}
                  </ul>) : <EmptyState title="No alerts" />}
              </Card>
            </div>
          );
        }}
      </QueryBoundary>
    </>
  );
}

function AckButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return <button className="btn-secondary !py-1 text-xs" disabled={busy} onClick={async () => { setBusy(true); try { await services.production.resolveAlert(id); } finally { setBusy(false); } }}>{busy ? '…' : 'Mark resolved'}</button>;
}
