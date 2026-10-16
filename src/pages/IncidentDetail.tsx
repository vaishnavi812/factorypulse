import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { services } from '../services';
import { useQuery } from '../lib/useQuery';
import { isOpen, resolutionHours } from '../lib/sla';
import { fmtDateTime, fmtHours } from '../lib/format';
import { OWNERS, SEVERITIES } from '../data/reference';
import type { Incident, IncidentStatus, Severity } from '../types';
import { Card, EmptyState, ErrorState, Field, PageHeader, Select, Spinner } from '../components/ui';
import { SeverityBadge, SlaBadge, StatusBadge } from '../components/Badges';

const NEXT: IncidentStatus[] = ['New', 'Assigned', 'In Progress', 'Pending Info', 'Resolved', 'Closed'];

export default function IncidentDetail() {
  const { id = '' } = useParams();
  const q = useQuery(() => services.incidents.get(id), [id]);
  return (
    <>
      <Link to="/incidents" className="mb-3 inline-block text-sm text-brand-600 hover:underline">← All incidents</Link>
      {q.error ? <ErrorState message={q.error} onRetry={q.reload} /> : q.loading && q.data === undefined ? <Spinner /> :
        q.data ? <Detail inc={q.data} /> : <EmptyState title={`Incident ${id} not found`} hint="It may have been removed or the link is wrong." />}
    </>
  );
}

function Detail({ inc }: { inc: Incident }) {
  const [status, setStatus] = useState<IncidentStatus>(inc.status);
  const [owner, setOwner] = useState(inc.owner);
  const [priority, setPriority] = useState<Severity>(inc.priority);
  const [notes, setNotes] = useState(inc.resolutionNotes ?? '');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [saved, setSaved] = useState(false);
  useEffect(() => { setStatus(inc.status); setOwner(inc.owner); setPriority(inc.priority); setNotes(inc.resolutionNotes ?? ''); }, [inc]);

  const dirty = status !== inc.status || owner !== inc.owner || priority !== inc.priority || notes !== (inc.resolutionNotes ?? '') || comment.trim() !== '';
  const closing = status === 'Resolved' || status === 'Closed';

  async function save() {
    setBusy(true); setErr(undefined); setSaved(false);
    try {
      await services.incidents.update(inc.id, { status, owner, priority, resolutionNotes: notes }, comment.trim() || (closing && status !== inc.status ? notes : undefined));
      setComment(''); setSaved(true);
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  }

  const hrs = resolutionHours(inc);
  return (
    <>
      <PageHeader title={`${inc.id} · ${inc.errorCode}`} subtitle={`${inc.factory} · ${inc.workCenter} · ${inc.application}`}
        actions={<><SeverityBadge s={inc.priority} /><StatusBadge s={inc.status} /><SlaBadge incident={inc} /></>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Description">
            <p className="whitespace-pre-wrap text-sm">{inc.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Meta k="Created" v={fmtDateTime(inc.createdAt)} /><Meta k="SLA deadline" v={fmtDateTime(inc.slaDeadline)} />
              <Meta k="Owner" v={inc.owner} /><Meta k={hrs !== undefined ? 'Resolution time' : 'Resolved'} v={hrs !== undefined ? fmtHours(hrs) : '—'} />
            </dl>
            <div className="mt-4"><Link className="btn-secondary" to={`/assistant?code=${encodeURIComponent(inc.errorCode)}&desc=${encodeURIComponent(inc.description)}`}>✦ Get troubleshooting suggestions</Link></div>
          </Card>
          <Card title="History">
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {[...inc.history].reverse().map((h, k) => (
                <li key={k} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                  <div className="text-sm font-medium">{h.action}</div>
                  <div className="text-xs text-slate-500">{h.by} · {fmtDateTime(h.at)}</div>
                  {h.note && <p className="mt-1 rounded bg-slate-50 p-2 text-sm text-slate-700">{h.note}</p>}
                </li>))}
            </ol>
          </Card>
        </div>
        <Card title={isOpen(inc) ? 'Update incident' : 'Reopen / edit'} className="h-fit">
          <div className="space-y-3">
            <Field label="Status"><Select value={status} onChange={(v) => setStatus(v as IncidentStatus)} options={NEXT} /></Field>
            <Field label="Owner"><Select value={owner} onChange={setOwner} options={OWNERS} /></Field>
            <Field label="Priority" hint="Changing priority recalculates the SLA deadline."><Select value={priority} onChange={(v) => setPriority(v as Severity)} options={SEVERITIES} /></Field>
            <Field label={`Resolution notes${closing ? ' (required)' : ''}`}><textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What fixed it? Reference the KB article used." /></Field>
            <Field label="Add comment"><textarea className="input min-h-[60px]" value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
            {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
            {saved && !dirty && <p className="text-sm text-emerald-600">Saved.</p>}
            <button className="btn-primary w-full" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </Card>
      </div>
    </>
  );
}

const Meta = ({ k, v }: { k: string; v: string }) => <div><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>;
