import { Link } from 'react-router-dom';
import { services } from '../services';
import { useQuery } from '../lib/useQuery';
import { useFilters } from '../lib/filters';
import { applyFilters, countBy, dailyBuckets } from '../lib/analytics';
import { isOpen, slaState } from '../lib/sla';
import { Badge, Card, EmptyState, PageHeader, QueryBoundary, StatCard } from '../components/ui';
import { FilterBar } from '../components/FilterBar';
import { BarList, ColumnChart, LineChart } from '../components/charts';
import { SeverityBadge } from '../components/Badges';
import { relTime } from '../lib/format';
import { FACTORIES } from '../data/reference';

export default function Dashboard() {
  const { filters } = useFilters();
  const q = useQuery(async () => {
    const [incidents, orders, wcs, alerts] = await Promise.all([
      services.incidents.list(), services.production.listOrders(), services.production.listWorkCenters(), services.production.listAlerts(),
    ]);
    return { incidents, orders, wcs, alerts };
  });

  return (
    <>
      <PageHeader title="Operations Dashboard" subtitle="Live view of incidents, production and alerts across all factories" />
      <FilterBar />
      <QueryBoundary q={q}>
        {({ incidents, orders, wcs, alerts }) => {
          const list = applyFilters(incidents, filters);
          const open = list.filter(isOpen);
          const breached = open.filter((i) => slaState(i) === 'Breached');
          const atRisk = open.filter((i) => slaState(i) === 'At risk');
          const fOrders = orders.filter((o) => !filters.factory || o.factory === filters.factory);
          const fWcs = wcs.filter((w) => !filters.factory || w.factory === filters.factory);
          const fAlerts = alerts.filter((a) => (!filters.factory || a.factory === filters.factory) && !a.resolved && (!filters.severity || a.severity === filters.severity));
          const blocked = fWcs.filter((w) => w.status === 'Blocked');

          const buckets = dailyBuckets(filters.days);
          const created = buckets.map((b) => list.filter((i) => i.createdAt.slice(0, 10) === b.key).length);
          const closed = buckets.map((b) => list.filter((i) => i.resolvedAt?.slice(0, 10) === b.key).length);
          const topErrors = countBy(list, (i) => i.errorCode).slice(0, 6);
          const perFactory = FACTORIES.filter((f) => !filters.factory || f === filters.factory).map((f) => {
            const fl = list.filter((i) => i.factory === f);
            return { f, total: fl.length, breached: fl.filter((i) => slaState(i) === 'Breached').length };
          });
          const attention = [...breached, ...atRisk].sort((a, b) => a.slaDeadline.localeCompare(b.slaDeadline)).slice(0, 6);

          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard label="Open incidents" value={open.length} tone="blue" hint={`${list.length} in period`} />
                <StatCard label="SLA breaches" value={breached.length} tone={breached.length ? 'red' : 'green'} hint="open & past deadline" />
                <StatCard label="Nearing SLA" value={atRisk.length} tone={atRisk.length ? 'amber' : 'green'} hint="last 25% of window" />
                <StatCard label="Orders in progress" value={fOrders.filter((o) => o.status === 'In Progress').length} tone="blue" hint={`${fOrders.length} total`} />
                <StatCard label="Blocked work centers" value={blocked.length} tone={blocked.length ? 'red' : 'green'} hint={`of ${fWcs.length}`} />
                <StatCard label="Unresolved alerts" value={fAlerts.length} tone={fAlerts.length ? 'amber' : 'green'} hint={`${fAlerts.filter((a) => a.severity === 'Critical').length} critical`} />
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                <Card title="Incident trend (created vs. resolved)" className="xl:col-span-2">
                  {list.length ? <LineChart labels={buckets.map((b) => b.label)} series={[{ name: 'Created', values: created }, { name: 'Resolved', values: closed, color: '#10b981' }]} /> : <EmptyState title="No incidents for these filters" hint="Try widening the date range or clearing filters." />}
                </Card>
                <Card title="Top error categories">
                  {topErrors.length ? <BarList items={topErrors} /> : <EmptyState title="No data" />}
                </Card>
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                <Card title="Factory performance (incidents vs. SLA breaches)" className="xl:col-span-2">
                  <ColumnChart categories={perFactory.map((p) => p.f)} series={[{ name: 'Incidents', values: perFactory.map((p) => p.total) }, { name: 'SLA breached', values: perFactory.map((p) => p.breached), color: '#ef4444' }]} />
                </Card>
                <Card title="Needs attention" action={<Link className="text-xs text-brand-600 hover:underline" to="/incidents">All incidents →</Link>}>
                  {attention.length ? (
                    <ul className="divide-y divide-slate-100">
                      {attention.map((i) => (
                        <li key={i.id} className="py-2">
                          <Link to={`/incidents/${i.id}`} className="block hover:bg-slate-50">
                            <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium text-brand-700">{i.id}</span><SeverityBadge s={i.priority} /></div>
                            <div className="truncate text-xs text-slate-600">{i.factory} · {i.errorCode} · {i.description}</div>
                            <div className="mt-0.5"><Badge tone={slaState(i) === 'Breached' ? 'red' : 'amber'}>{slaState(i)} · {relTime(i.slaDeadline)}</Badge></div>
                          </Link>
                        </li>))}
                    </ul>
                  ) : <EmptyState title="Nothing at risk" hint="No open incidents are breached or nearing their SLA." />}
                </Card>
              </div>

              <Card title="Open factory alerts" action={<Link className="text-xs text-brand-600 hover:underline" to="/production">Production →</Link>}>
                {fAlerts.length ? (
                  <ul className="grid gap-2 md:grid-cols-2">
                    {fAlerts.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 rounded-md border border-slate-100 p-2.5 text-sm">
                        <SeverityBadge s={a.severity} />
                        <div className="min-w-0"><div>{a.message}</div><div className="text-xs text-slate-500">{a.factory} · {a.workCenter} · {relTime(a.raisedAt)}</div></div>
                      </li>))}
                  </ul>
                ) : <EmptyState title="No unresolved alerts" />}
              </Card>
            </div>
          );
        }}
      </QueryBoundary>
    </>
  );
}
