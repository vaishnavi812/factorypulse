import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { clearLog, getLog, getStatus, markAllRead, subscribeLog, type NotifierStatus } from '../services/notifications';
import { Badge, Card, DataTable, EmptyState, PageHeader } from '../components/ui';
import { fmtDateTime } from '../lib/format';

export const useUnread = () => useSyncExternalStore(subscribeLog, () => getLog().filter((r) => !r.read).length);

const tone = (s: string) => (s === 'sent' ? 'green' : s === 'dry-run' ? 'blue' : s === 'skipped' ? 'slate' : 'red');

export default function Notifications() {
  const log = useSyncExternalStore(subscribeLog, getLog);
  const [status, setStatus] = useState<NotifierStatus | null | undefined>();
  useEffect(() => { getStatus().then(setStatus); markAllRead(); }, []);
  return (
    <>
      <PageHeader title="SLA Notifications" subtitle="Alerts are sent by email and Microsoft Teams before an SLA is breached, and again when it is"
        actions={<button className="btn-secondary" disabled={!log.length} onClick={clearLog}>Clear log</button>} />
      <Card title="Notifier status" className="mb-5">
        {status === undefined ? <span className="text-sm text-slate-500">Checking…</span> : status === null ? (
          <div className="text-sm text-red-700" role="alert"><b>Notifier service not running.</b> In-app alerts still work, but no email/Teams messages are sent. Start it with <code className="rounded bg-slate-100 px-1">npm run dev:all</code> (or <code className="rounded bg-slate-100 px-1">npm run notifier</code>).</div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={status.email ? 'green' : 'slate'}>Email: {status.email ? 'configured' : 'not configured'}</Badge>
            <Badge tone={status.teams ? 'green' : 'slate'}>Teams: {status.teams ? 'configured' : 'not configured'}</Badge>
            {status.dryRun && <span className="text-amber-700">Dry-run: messages are only written to <code>server/outbox.log</code>. Copy <code>.env.example</code> to <code>.env</code> and add SMTP / Teams webhook settings.</span>}
          </div>)}
        <p className="mt-3 text-xs text-slate-500">Rules: an <b>at-risk</b> alert fires when 25% of the SLA window remains; a <b>breached</b> alert fires when the deadline passes. Each incident alerts once per stage. This prototype checks every 30 s while the app is open; production should run the check in a backend scheduler (see docs/INTEGRATION.md).</p>
      </Card>
      <Card title="Alert log">
        <DataTable rows={log} rowKey={(r) => r.key} pageSize={10}
          empty={<EmptyState title="No alerts sent yet" hint="Alerts appear here when an open incident nears or passes its SLA deadline." />}
          columns={[
            { key: 'at', header: 'Time', render: (r) => fmtDateTime(r.at), sort: (r) => r.at },
            { key: 'k', header: 'Alert', render: (r) => <Badge tone={r.kind === 'breached' ? 'red' : 'amber'}>{r.kind === 'breached' ? 'Breached' : 'At risk'}</Badge> },
            { key: 'i', header: 'Incident', render: (r) => <Link className="font-medium text-brand-700 hover:underline" to={`/incidents/${r.incidentId}`}>{r.incidentId}</Link> },
            { key: 'p', header: 'Priority / factory', render: (r) => `${r.priority} · ${r.factory}` },
            { key: 'e', header: 'Email', render: (r) => <Badge tone={tone(r.email)}>{r.email}</Badge> },
            { key: 't', header: 'Teams', render: (r) => <Badge tone={tone(r.teams)}>{r.teams}</Badge> },
          ]} />
      </Card>
    </>
  );
}
