import { useFilters } from '../lib/filters';
import { services } from '../services';
import { useQuery } from '../lib/useQuery';
import { applyFilters, avgResolutionHours, countBy, dailyBuckets, slaCompliance } from '../lib/analytics';
import { FACTORIES, APPLICATIONS } from '../data/reference';
import { fmtHours } from '../lib/format';
import { Card, DataTable, EmptyState, PageHeader, QueryBoundary, StatCard } from '../components/ui';
import { FilterBar } from '../components/FilterBar';
import { BarList, ColumnChart, Gauge, LineChart } from '../components/charts';
import { inRange } from '../lib/filters';

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export default function Reports() {
  const { filters } = useFilters();
  const q = useQuery(async () => {
    const [incidents, downtime, kb] = await Promise.all([services.incidents.list(), services.production.listDowntime(), services.knowledge.list()]);
    return { incidents, downtime, kb };
  });
  return (
    <>
      <PageHeader title="Reports" subtitle="Volume, SLA compliance, recurring errors, resolution time and downtime" />
      <FilterBar />
      <QueryBoundary q={q}>
        {({ incidents, downtime }) => {
          const list = applyFilters(incidents, filters);
          if (!list.length) return <Card><EmptyState title="No incidents match the filters" hint="Widen the date range or clear filters to see reports." /></Card>;
          const sla = slaCompliance(list);
          const factories = FACTORIES.filter((f) => !filters.factory || f === filters.factory);
          const byFA = APPLICATIONS.map((a) => ({ a, vals: factories.map((f) => list.filter((i) => i.factory === f && i.application === a).length) }));
          const recurring = countBy(list, (i) => i.errorCode).slice(0, 8);
          const kbTitle = new Map(q.data?.kb.map((k) => [k.errorCode, k.title]));
          const buckets = dailyBuckets(filters.days);
          // weekly downtime when range is long to keep the chart readable
          const dt = downtime.filter((d) => inRange(d.date, filters.days || 90) && (!filters.factory || d.factory === filters.factory));
          const dtSeries = factories.map((f) => ({ name: f, values: buckets.map((b) => dt.filter((d) => d.factory === f && d.date === b.key).reduce((s, d) => s + d.minutes, 0)) }));
          const totalDt = dt.reduce((s, d) => s + d.minutes, 0);
          const slaByF = factories.map((f) => ({ f, ...slaCompliance(list.filter((i) => i.factory === f)) }));
          const resByPrio = ['Critical', 'High', 'Medium', 'Low'].map((p) => ({ p, h: avgResolutionHours(list.filter((i) => i.priority === p)) }));

          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Incidents" value={list.length} tone="blue" />
                <StatCard label="SLA compliance" value={`${sla.pct}%`} tone={sla.pct >= 90 ? 'green' : sla.pct >= 75 ? 'amber' : 'red'} hint={`${sla.ok} of ${sla.total} decided`} />
                <StatCard label="Avg. resolution time" value={fmtHours(avgResolutionHours(list))} hint="resolved incidents" />
                <StatCard label="Downtime in period" value={`${(totalDt / 60).toFixed(0)} h`} tone="amber" />
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <Card title="Incident volume by factory and application" action={<button className="text-xs text-brand-600 hover:underline" onClick={() => downloadCsv('incident-volume.csv', [['Application', ...factories], ...byFA.map((r) => [r.a, ...r.vals])])}>Export CSV</button>}>
                  <ColumnChart categories={factories} series={byFA.map((r, i) => ({ name: r.a, values: r.vals, color: ['#2f7bf5', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'][i] }))} />
                </Card>
                <Card title="SLA compliance">
                  <div className="flex flex-wrap items-center gap-6"><Gauge value={sla.pct} label="Overall SLA compliance" />
                    <div className="min-w-[200px] flex-1"><BarList unit="%" color="#10b981" items={slaByF.map((s) => ({ label: s.f, value: s.pct, sub: `(${s.ok}/${s.total})` }))} /></div></div>
                  <p className="mt-3 text-xs text-slate-500">Compliance = incidents resolved within SLA ÷ incidents with a final outcome (resolved, or open and already breached).</p>
                </Card>
                <Card title="Top recurring errors" action={<button className="text-xs text-brand-600 hover:underline" onClick={() => downloadCsv('recurring-errors.csv', [['Error code', 'Count', 'KB title'], ...recurring.map((r) => [r.label, r.value, kbTitle.get(r.label) ?? 'No KB article'])])}>Export CSV</button>}>
                  <DataTable pageSize={8} rows={recurring} rowKey={(r) => r.label} columns={[
                    { key: 'c', header: 'Error', render: (r) => <span className="font-mono text-xs">{r.label}</span> },
                    { key: 'n', header: 'Count', render: (r) => r.value, sort: (r) => r.value },
                    { key: 't', header: 'Knowledge article', render: (r) => kbTitle.get(r.label) ?? <span className="text-amber-700">No KB article — candidate to document</span> },
                  ]} />
                </Card>
                <Card title="Average resolution time by priority (hours)">
                  <BarList color="#8b5cf6" unit=" h" items={resByPrio.map((r) => ({ label: r.p, value: Math.round(r.h * 10) / 10 }))} />
                </Card>
              </div>
              <Card title="Production downtime trend (minutes per day)">
                <LineChart labels={buckets.map((b) => b.label)} series={dtSeries} unit=" min" />
              </Card>
            </div>
          );
        }}
      </QueryBoundary>
    </>
  );
}
