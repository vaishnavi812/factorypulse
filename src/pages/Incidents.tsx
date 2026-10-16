import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { services } from '../services';
import { useQuery } from '../lib/useQuery';
import { isOpen, slaState } from '../lib/sla';
import { fmtDateTime } from '../lib/format';
import { APPLICATIONS, FACTORIES, OWNERS, SEVERITIES, WORK_CENTERS } from '../data/reference';
import type { Incident, IncidentStatus, NewIncident, Severity } from '../types';
import { Card, DataTable, EmptyState, Field, Modal, PageHeader, QueryBoundary, Select, type Column } from '../components/ui';
import { SeverityBadge, SlaBadge, StatusBadge } from '../components/Badges';

const STATUSES: IncidentStatus[] = ['New', 'Assigned', 'In Progress', 'Pending Info', 'Resolved', 'Closed'];
const SLA_FILTERS = ['Breached', 'At risk', 'On track'] as const;

export default function Incidents() {
  const nav = useNavigate();
  const q = useQuery(() => services.incidents.list());
  const [text, setText] = useState('');
  const [f, setF] = useState({ factory: '', application: '', status: '', priority: '', owner: '', sla: '' });
  const [openOnly, setOpenOnly] = useState(true);
  const [creating, setCreating] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  const columns: Column<Incident>[] = useMemo(() => [
    { key: 'id', header: 'ID', render: (i) => <span className="font-medium text-brand-700">{i.id}</span>, sort: (i) => i.id },
    { key: 'factory', header: 'Factory', render: (i) => i.factory, sort: (i) => i.factory },
    { key: 'app', header: 'Application', render: (i) => i.application, sort: (i) => i.application },
    { key: 'wc', header: 'Work center', render: (i) => i.workCenter },
    { key: 'code', header: 'Error', render: (i) => <span className="font-mono text-xs">{i.errorCode}</span>, sort: (i) => i.errorCode },
    { key: 'desc', header: 'Description', render: (i) => <span className="line-clamp-2 min-w-[180px]">{i.description}</span> },
    { key: 'prio', header: 'Priority', render: (i) => <SeverityBadge s={i.priority} />, sort: (i) => SEVERITIES.indexOf(i.priority) },
    { key: 'owner', header: 'Owner', render: (i) => i.owner, sort: (i) => i.owner },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge s={i.status} />, sort: (i) => STATUSES.indexOf(i.status) },
    { key: 'created', header: 'Created', render: (i) => <span className="whitespace-nowrap">{fmtDateTime(i.createdAt)}</span>, sort: (i) => i.createdAt },
    { key: 'sla', header: 'SLA', render: (i) => <SlaBadge incident={i} />, sort: (i) => i.slaDeadline },
  ], []);

  return (
    <>
      <PageHeader title="MES Incidents" subtitle="Create, assign, track and close incidents with SLA monitoring"
        actions={<button className="btn-primary" onClick={() => setCreating(true)}>＋ New incident</button>} />
      <QueryBoundary q={q}>
        {(all) => {
          const t = text.trim().toLowerCase();
          const rows = all.filter((i) =>
            (!openOnly || isOpen(i)) &&
            (!f.factory || i.factory === f.factory) && (!f.application || i.application === f.application) &&
            (!f.status || i.status === f.status) && (!f.priority || i.priority === f.priority) &&
            (!f.owner || i.owner === f.owner) && (!f.sla || slaState(i) === f.sla) &&
            (!t || [i.id, i.errorCode, i.description, i.workCenter, i.owner].some((s) => s.toLowerCase().includes(t))))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return (
            <Card>
              <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                <input className="input col-span-2 md:col-span-4 xl:col-span-2" type="search" placeholder="Search ID, error code, text, owner…" aria-label="Search incidents" value={text} onChange={(e) => setText(e.target.value)} />
                <Select label="Factory" value={f.factory} onChange={(v) => set({ factory: v })} options={FACTORIES} placeholder="Factory" />
                <Select label="Application" value={f.application} onChange={(v) => set({ application: v })} options={APPLICATIONS} placeholder="Application" />
                <Select label="Status" value={f.status} onChange={(v) => set({ status: v })} options={STATUSES} placeholder="Status" />
                <Select label="Priority" value={f.priority} onChange={(v) => set({ priority: v })} options={SEVERITIES} placeholder="Priority" />
                <Select label="SLA" value={f.sla} onChange={(v) => set({ sla: v })} options={SLA_FILTERS} placeholder="SLA state" />
              </div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open incidents only</label>
                <span className="text-slate-500">{rows.length} of {all.length} incidents</span>
              </div>
              <DataTable rows={rows} columns={columns} rowKey={(i) => i.id} onRowClick={(i) => nav(`/incidents/${i.id}`)}
                rowClass={(i) => (slaState(i) === 'Breached' && isOpen(i) ? 'bg-red-50/60' : slaState(i) === 'At risk' ? 'bg-amber-50/60' : undefined)}
                empty={<EmptyState title="No incidents match" hint="Adjust the search or filters, or include closed incidents." />} />
            </Card>
          );
        }}
      </QueryBoundary>
      <NewIncidentModal open={creating} onClose={() => setCreating(false)} onCreated={(i) => { setCreating(false); nav(`/incidents/${i.id}`); }} />
    </>
  );
}

const BLANK: NewIncident = { factory: 'Stuttgart', application: 'MES Core', workCenter: WORK_CENTERS.Stuttgart[0], errorCode: '', description: '', priority: 'Medium', owner: 'Unassigned' };

function NewIncidentModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (i: Incident) => void }) {
  const [v, setV] = useState<NewIncident>(BLANK);
  const [errors, setErrors] = useState<Partial<Record<keyof NewIncident, string>>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string>();
  const set = (p: Partial<NewIncident>) => setV({ ...v, ...p });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: typeof errors = {};
    if (!/^[A-Z]{2,5}-\d{3,5}$/i.test(v.errorCode.trim())) er.errorCode = 'Use format like MES-1001';
    if (v.description.trim().length < 10) er.description = 'Describe the problem (min. 10 characters)';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true); setFail(undefined);
    try {
      const inc = await services.incidents.create({ ...v, errorCode: v.errorCode.trim().toUpperCase(), description: v.description.trim() });
      setV(BLANK); onCreated(inc);
    } catch (x) { setFail(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="New incident">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Factory"><Select value={v.factory} onChange={(x) => set({ factory: x, workCenter: WORK_CENTERS[x][0] })} options={FACTORIES} /></Field>
          <Field label="Work center"><Select value={v.workCenter} onChange={(x) => set({ workCenter: x })} options={WORK_CENTERS[v.factory]} /></Field>
          <Field label="Application"><Select value={v.application} onChange={(x) => set({ application: x })} options={APPLICATIONS} /></Field>
          <Field label="Error code" error={errors.errorCode}><input className="input font-mono" placeholder="MES-1001" value={v.errorCode} onChange={(e) => set({ errorCode: e.target.value })} /></Field>
          <Field label="Priority" hint="Sets the SLA: Critical 4h · High 8h · Medium 24h · Low 72h"><Select value={v.priority} onChange={(x) => set({ priority: x as Severity })} options={SEVERITIES} /></Field>
          <Field label="Owner"><Select value={v.owner} onChange={(x) => set({ owner: x })} options={OWNERS} /></Field>
        </div>
        <Field label="Description" error={errors.description}><textarea className="input min-h-[90px]" value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="What happened, what was the operator doing, which screen/message?" /></Field>
        {fail && <p role="alert" className="text-sm text-red-600">{fail}</p>}
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create incident'}</button></div>
      </form>
    </Modal>
  );
}
