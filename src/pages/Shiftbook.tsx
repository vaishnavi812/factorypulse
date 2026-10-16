import { useState } from 'react';
import { services } from '../services';
import { useQuery } from '../lib/useQuery';
import { FACTORIES, OWNERS } from '../data/reference';
import type { FollowUpTask, ShiftEntry, ShiftName } from '../types';
import { Badge, Card, EmptyState, Field, Modal, PageHeader, QueryBoundary, Select } from '../components/ui';
import { fmtDate } from '../lib/format';

const SHIFTS: ShiftName[] = ['Early', 'Late', 'Night'];
const today = () => new Date().toISOString().slice(0, 10);

export default function Shiftbook() {
  const q = useQuery(() => services.shiftbook.list());
  const [creating, setCreating] = useState(false);
  const [factory, setFactory] = useState('');
  return (
    <>
      <PageHeader title="Digital Shiftbook" subtitle="Shift handover entries, machine problems and follow-up actions"
        actions={<><div className="w-44"><Select label="Factory" value={factory} onChange={setFactory} options={FACTORIES} placeholder="All factories" /></div><button className="btn-primary" onClick={() => setCreating(true)}>＋ New handover</button></>} />
      <QueryBoundary q={q}>
        {(all) => {
          const entries = all.filter((e) => !factory || e.factory === factory).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
          const pending = entries.flatMap((e) => e.tasks.filter((t) => !t.done).map((t) => ({ e, t }))).sort((a, b) => a.t.due.localeCompare(b.t.due));
          return (
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                {entries.length ? entries.map((e) => <Entry key={e.id} e={e} />) : <Card><EmptyState title="No handover entries" hint="Create the first entry for this shift." /></Card>}
              </div>
              <Card title={`Unresolved tasks (${pending.length})`} className="h-fit">
                {pending.length ? (
                  <ul className="space-y-2.5">
                    {pending.map(({ e, t }) => (
                      <li key={t.id} className="rounded-md border border-slate-100 p-2.5 text-sm">
                        <TaskRow entryId={e.id} t={t} />
                        <div className="mt-1 text-xs text-slate-500">From {e.factory} {e.shift} shift · {fmtDate(e.date)}</div>
                      </li>))}
                  </ul>) : <EmptyState title="All caught up" hint="No open follow-ups from previous shifts." />}
              </Card>
            </div>
          );
        }}
      </QueryBoundary>
      <NewEntry open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function TaskRow({ entryId, t }: { entryId: string; t: FollowUpTask }) {
  const overdue = !t.done && t.due < today();
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-1" checked={t.done} onChange={(ev) => services.shiftbook.setTaskDone(entryId, t.id, ev.target.checked)} />
      <span className={t.done ? 'text-slate-400 line-through' : ''}>
        {t.text}<span className="block text-xs text-slate-500">{t.assignee} · due {t.due} {overdue && <Badge tone="red">overdue</Badge>}</span>
      </span>
    </label>
  );
}

function Entry({ e }: { e: ShiftEntry }) {
  return (
    <Card title={<span>{e.factory} · {e.shift} shift <span className="font-normal text-slate-500">· {fmtDate(e.date)} · {e.author}</span></span>}>
      <dl className="space-y-3 text-sm">
        <div><dt className="text-xs font-medium uppercase text-slate-500">Production status</dt><dd>{e.productionStatus || '—'}</dd></div>
        <div><dt className="text-xs font-medium uppercase text-slate-500">Machine problems</dt><dd>{e.machineProblems || '—'}</dd></div>
        <div><dt className="text-xs font-medium uppercase text-slate-500">Pending tasks</dt>
          <dd>{e.tasks.length ? <ul className="mt-1 space-y-1.5">{e.tasks.map((t) => <li key={t.id}><TaskRow entryId={e.id} t={t} /></li>)}</ul> : '—'}</dd></div>
      </dl>
    </Card>
  );
}

function NewEntry({ open, onClose }: { open: boolean; onClose: () => void }) {
  const blank = { factory: 'Stuttgart', shift: 'Early' as ShiftName, date: today(), author: '', productionStatus: '', machineProblems: '' };
  const [v, setV] = useState(blank);
  const [tasks, setTasks] = useState<Omit<FollowUpTask, 'id' | 'done'>[]>([]);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!v.author.trim()) return setErr('Author is required.');
    if (!v.productionStatus.trim()) return setErr('Describe the production status for the next shift.');
    setBusy(true); setErr(undefined);
    try {
      const stamp = Date.now();
      await services.shiftbook.create({ ...v, tasks: tasks.filter((t) => t.text.trim()).map((t, i) => ({ ...t, id: `T-${stamp}-${i}`, done: false })) });
      setV(blank); setTasks([]); onClose();
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  }
  const upd = (i: number, p: Partial<(typeof tasks)[number]>) => setTasks(tasks.map((t, k) => (k === i ? { ...t, ...p } : t)));
  return (
    <Modal open={open} onClose={onClose} title="New shift handover" wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Factory"><Select value={v.factory} onChange={(x) => setV({ ...v, factory: x })} options={FACTORIES} /></Field>
          <Field label="Shift"><Select value={v.shift} onChange={(x) => setV({ ...v, shift: x as ShiftName })} options={SHIFTS} /></Field>
          <Field label="Date"><input type="date" className="input" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <Field label="Author"><input className="input" value={v.author} onChange={(e) => setV({ ...v, author: e.target.value })} /></Field>
        </div>
        <Field label="Production status"><textarea className="input min-h-[70px]" value={v.productionStatus} onChange={(e) => setV({ ...v, productionStatus: e.target.value })} placeholder="Orders, output vs. plan, quality issues…" /></Field>
        <Field label="Machine problems"><textarea className="input min-h-[60px]" value={v.machineProblems} onChange={(e) => setV({ ...v, machineProblems: e.target.value })} /></Field>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm font-medium">Pending tasks / follow-up actions
            <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setTasks([...tasks, { text: '', assignee: OWNERS[0], due: today() }])}>＋ Add task</button></div>
          {tasks.map((t, i) => (
            <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
              <input className="input" placeholder="Task" aria-label="Task" value={t.text} onChange={(e) => upd(i, { text: e.target.value })} />
              <Select label="Assignee" value={t.assignee} onChange={(x) => upd(i, { assignee: x })} options={OWNERS.filter((o) => o !== 'Unassigned')} />
              <input type="date" aria-label="Due date" className="input" value={t.due} onChange={(e) => upd(i, { due: e.target.value })} />
              <button type="button" aria-label="Remove task" className="btn-secondary" onClick={() => setTasks(tasks.filter((_, k) => k !== i))}>✕</button>
            </div>))}
        </div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save handover'}</button></div>
      </form>
    </Modal>
  );
}
