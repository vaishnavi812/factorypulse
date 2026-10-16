import { useState } from 'react';
import { services } from '../services';
import { useQuery } from '../lib/useQuery';
import { KB_CATEGORIES } from '../data/reference';
import type { KnowledgeArticle } from '../types';
import { Badge, Card, EmptyState, Field, Modal, PageHeader, QueryBoundary, Select } from '../components/ui';

type Draft = Omit<KnowledgeArticle, 'id' | 'updatedAt'> & { id?: string };
const BLANK: Draft = { errorCode: '', title: '', category: KB_CATEGORIES[0], symptoms: '', rootCause: '', solution: [''], docLink: '', sourceDoc: '', tags: [], approved: false };

export default function Knowledge() {
  const q = useQuery(() => services.knowledge.list());
  const [text, setText] = useState('');
  const [cat, setCat] = useState('');
  const [sel, setSel] = useState<KnowledgeArticle>();
  const [edit, setEdit] = useState<Draft>();

  return (
    <>
      <PageHeader title="Knowledge Center" subtitle="Error codes, symptoms, root causes and approved resolutions"
        actions={<button className="btn-primary" onClick={() => setEdit(BLANK)}>＋ New article</button>} />
      <QueryBoundary q={q}>
        {(all) => {
          const t = text.trim().toLowerCase();
          const rows = all.filter((a) => (!cat || a.category === cat) && (!t || [a.id, a.errorCode, a.title, a.symptoms, a.rootCause, a.tags.join(' '), a.solution.join(' ')].join(' ').toLowerCase().includes(t)))
            .sort((a, b) => a.errorCode.localeCompare(b.errorCode));
          return (
            <>
              <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_14rem]">
                <input type="search" className="input" aria-label="Search knowledge" placeholder="Search error code, symptom, cause, solution…" value={text} onChange={(e) => setText(e.target.value)} />
                <Select label="Category" value={cat} onChange={setCat} options={KB_CATEGORIES} placeholder="All categories" />
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {KB_CATEGORIES.map((c) => { const n = all.filter((a) => a.category === c).length; return n ? <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={`rounded-full border px-2.5 py-1 text-xs ${cat === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>{c} ({n})</button> : null; })}
              </div>
              {rows.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {rows.map((a) => (
                    <button key={a.id} onClick={() => setSel(a)} className="card p-4 text-left transition hover:border-brand-500 hover:shadow">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5"><Badge tone="blue">{a.errorCode}</Badge><Badge>{a.category}</Badge>{!a.approved && <Badge tone="amber">Draft</Badge>}</div>
                      <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{a.symptoms}</p>
                      <div className="mt-2 text-[11px] text-slate-400">{a.id} · updated {new Date(a.updatedAt).toLocaleDateString()}</div>
                    </button>))}
                </div>
              ) : <Card><EmptyState title="No articles found" hint="Try a different keyword or category, or create a new article." /></Card>}
              <Modal open={!!sel} onClose={() => setSel(undefined)} title={sel?.title ?? ''} wide>
                {sel && <Article a={sel} onEdit={() => { setEdit(sel); setSel(undefined); }} onDeleted={() => setSel(undefined)} />}
              </Modal>
            </>
          );
        }}
      </QueryBoundary>
      <Editor draft={edit} onClose={() => setEdit(undefined)} />
    </>
  );
}

function Article({ a, onEdit, onDeleted }: { a: KnowledgeArticle; onEdit: () => void; onDeleted: () => void }) {
  const [err, setErr] = useState<string>();
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-1.5"><Badge tone="blue">{a.errorCode}</Badge><Badge>{a.category}</Badge>{a.approved ? <Badge tone="green">Approved</Badge> : <Badge tone="amber">Draft — not used by assistant</Badge>}{a.tags.map((t) => <Badge key={t} tone="purple">{t}</Badge>)}</div>
      <Section h="Symptoms">{a.symptoms}</Section>
      <Section h="Root cause">{a.rootCause}</Section>
      <Section h="Resolution steps"><ol className="list-inside list-decimal space-y-1">{a.solution.map((s, i) => <li key={i}>{s}</li>)}</ol></Section>
      <Section h="Source"><div>{a.id} · {a.sourceDoc}</div><a className="text-brand-600 hover:underline" href={a.docLink || '#'} target="_blank" rel="noreferrer noopener">{a.docLink || 'No link'}</a></Section>
      {err && <p role="alert" className="text-red-600">{err}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="btn-secondary" onClick={async () => { if (!confirm(`Delete ${a.id}?`)) return; try { await services.knowledge.remove(a.id); onDeleted(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } }}>Delete</button>
        <button className="btn-primary" onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}
const Section = ({ h, children }: { h: string; children: React.ReactNode }) => <div><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</h3><div>{children}</div></div>;

function Editor({ draft, onClose }: { draft?: Draft; onClose: () => void }) {
  return <Modal open={!!draft} onClose={onClose} title={draft?.id ? `Edit ${draft.id}` : 'New knowledge article'} wide>{draft && <EditorForm key={draft.id ?? 'new'} initial={draft} onClose={onClose} />}</Modal>;
}
function EditorForm({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const [v, setV] = useState<Draft>(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const steps = v.solution.map((s) => s.trim()).filter(Boolean);
    if (!v.errorCode.trim() || !v.title.trim() || !v.symptoms.trim()) return setErr('Error code, title and symptoms are required.');
    if (v.approved && (!steps.length || !v.rootCause.trim() || !v.sourceDoc.trim())) return setErr('Approved articles need a root cause, at least one step and a source document.');
    setBusy(true); setErr(undefined);
    try { await services.knowledge.save({ ...v, errorCode: v.errorCode.trim().toUpperCase(), solution: steps, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }); onClose(); }
    catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Error code"><input className="input font-mono" value={v.errorCode} onChange={(e) => setV({ ...v, errorCode: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Title"><input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field></div>
        <Field label="Category"><Select value={v.category} onChange={(x) => setV({ ...v, category: x })} options={KB_CATEGORIES} /></Field>
        <div className="sm:col-span-2"><Field label="Tags (comma separated)"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></Field></div>
      </div>
      <Field label="Symptoms"><textarea className="input min-h-[60px]" value={v.symptoms} onChange={(e) => setV({ ...v, symptoms: e.target.value })} /></Field>
      <Field label="Root cause"><textarea className="input min-h-[60px]" value={v.rootCause} onChange={(e) => setV({ ...v, rootCause: e.target.value })} /></Field>
      <div>
        <div className="mb-1 flex items-center justify-between text-sm font-medium">Resolution steps<button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setV({ ...v, solution: [...v.solution, ''] })}>＋ Step</button></div>
        {v.solution.map((s, i) => (
          <div key={i} className="mb-1.5 flex gap-2"><span className="pt-2 text-xs text-slate-400">{i + 1}.</span>
            <input className="input" aria-label={`Step ${i + 1}`} value={s} onChange={(e) => setV({ ...v, solution: v.solution.map((x, k) => (k === i ? e.target.value : x)) })} />
            <button type="button" aria-label="Remove step" className="btn-secondary" onClick={() => setV({ ...v, solution: v.solution.length > 1 ? v.solution.filter((_, k) => k !== i) : [''] })}>✕</button></div>))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Source document"><input className="input" value={v.sourceDoc} onChange={(e) => setV({ ...v, sourceDoc: e.target.value })} placeholder="e.g. Runbook v4.2, §3.1" /></Field>
        <Field label="Documentation link"><input type="url" className="input" value={v.docLink} onChange={(e) => setV({ ...v, docLink: e.target.value })} placeholder="https://…" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.approved} onChange={(e) => setV({ ...v, approved: e.target.checked })} /> Approved for use by the Troubleshooting Assistant</label>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save article'}</button></div>
    </form>
  );
}
