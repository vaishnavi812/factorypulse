import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { services } from '../services';
import { useQuery } from '../lib/useQuery';
import { recommend, type Recommendation } from '../lib/troubleshoot';
import { Badge, Card, EmptyState, Field, PageHeader, QueryBoundary } from '../components/ui';

const EXAMPLES = [
  { code: 'MES-3003', desc: 'No cycle data from machine, OEE flat' },
  { code: 'MES-2007', desc: 'Label printer spool error' },
  { code: '', desc: 'Operator terminal freezes after login and confirmations are not saved' },
  { code: 'MES-9999', desc: 'Robot arm calibration drifts after tool change' },
];

export default function Assistant() {
  const [sp] = useSearchParams();
  const kb = useQuery(() => services.knowledge.list());
  const [code, setCode] = useState(sp.get('code') ?? '');
  const [desc, setDesc] = useState(sp.get('desc') ?? '');
  const [submitted, setSubmitted] = useState<{ code: string; desc: string } | null>(sp.get('code') || sp.get('desc') ? { code: sp.get('code') ?? '', desc: sp.get('desc') ?? '' } : null);

  return (
    <>
      <PageHeader title="AI Troubleshooting Assistant" subtitle="Recommends steps from approved knowledge articles — it never invents a resolution" />
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <strong>How it works:</strong> this prototype uses transparent keyword retrieval over <em>approved</em> articles in the Knowledge Center (runs locally, no external AI service).
        Every step is quoted from a source article. If nothing relevant is found, you will be told so.
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Describe the problem" className="h-fit">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setSubmitted({ code, desc }); }}>
            <Field label="Error code" hint="Optional, e.g. MES-1001"><input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Field label="Description / symptoms"><textarea className="input min-h-[110px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What do operators see? Which message appears?" /></Field>
            <button className="btn-primary w-full" disabled={!code.trim() && desc.trim().length < 5}>Find troubleshooting steps</button>
          </form>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-1.5 text-xs font-medium text-slate-500">Try an example</div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((e, i) => <button key={i} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50" onClick={() => { setCode(e.code); setDesc(e.desc); setSubmitted({ code: e.code, desc: e.desc }); }}>{e.code || 'No code'} · {e.desc.slice(0, 24)}…</button>)}
            </div>
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <QueryBoundary q={kb}>
            {(articles) => {
              if (!submitted) return <Card><EmptyState title="Enter an error code or symptoms" hint="Recommendations will appear here with their source documents." /></Card>;
              const recs = recommend(submitted.code, submitted.desc, articles);
              if (!recs.length) {
                return (
                  <Card>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                      <div className="font-semibold">No confirmed resolution found</div>
                      <p className="mt-1">The knowledge base has no approved article matching {submitted.code ? <b>{submitted.code}</b> : 'this description'}. No steps are suggested because none have been validated.</p>
                      <ul className="mt-2 list-inside list-disc">
                        <li>Escalate to MES support with logs and screenshots.</li>
                        <li>Once resolved, document the fix as a new article in the <Link className="underline" to="/knowledge">Knowledge Center</Link>.</li>
                      </ul>
                    </div>
                  </Card>
                );
              }
              return recs.map((r) => <RecCard key={r.article.id} r={r} />);
            }}
          </QueryBoundary>
        </div>
      </div>
    </>
  );
}

function RecCard({ r }: { r: Recommendation }) {
  const a = r.article;
  return (
    <Card title={<span>{a.title}</span>} action={<Badge tone={r.confidence === 'High' ? 'green' : r.confidence === 'Medium' ? 'amber' : 'slate'}>{r.confidence} match</Badge>}>
      <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
        <Badge tone="blue">{a.errorCode}</Badge><Badge>{a.category}</Badge>
        {r.exactCode && <Badge tone="green">Exact error-code match</Badge>}
        {r.matchedTerms.slice(0, 5).map((t) => <Badge key={t} tone="slate">“{t}”</Badge>)}
      </div>
      <p className="text-sm"><span className="font-medium">Likely root cause:</span> {a.rootCause}</p>
      <h3 className="mb-1 mt-3 text-sm font-medium">Recommended steps</h3>
      <ol className="list-inside list-decimal space-y-1 text-sm">{a.solution.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        <div><span className="font-medium">Source:</span> {a.id} · {a.sourceDoc}</div>
        <div>Last updated {new Date(a.updatedAt).toLocaleDateString()} · <a className="text-brand-600 hover:underline" href={a.docLink} target="_blank" rel="noreferrer noopener">Open documentation ↗</a> <span className="text-slate-400">(sample link)</span></div>
      </div>
    </Card>
  );
}
