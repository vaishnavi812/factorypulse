import { useState } from 'react';

export const PALETTE = ['#2f7bf5', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

export interface Series { name: string; color?: string; values: number[] }

/** Responsive SVG line chart with hover tooltip. */
export function LineChart({ labels, series, height = 220, unit = '' }: { labels: string[]; series: Series[]; height?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, padL = 36, padR = 10, padT = 10, padB = 24;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = Math.ceil(max / 4) * 4 || 4;
  const x = (i: number) => padL + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / nice) * (height - padT - padB);
  const step = Math.max(1, Math.ceil(labels.length / 7));
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={`Line chart: ${series.map((s) => s.name).join(', ')}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(labels.length - 1, Math.round(((px - padL) / (W - padL - padR)) * (labels.length - 1)))));
          }}>
          {[0, 1, 2, 3, 4].map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y((nice * t) / 4)} y2={y((nice * t) / 4)} stroke="#e2e8f0" />
              <text x={padL - 6} y={y((nice * t) / 4) + 4} textAnchor="end" fontSize="10" fill="#64748b">{Math.round((nice * t) / 4)}</text>
            </g>))}
          {labels.map((l, i) => i % step === 0 && <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="#64748b">{l}</text>)}
          {series.map((s, si) => (
            <polyline key={s.name} fill="none" stroke={s.color ?? PALETTE[si % PALETTE.length]} strokeWidth="2" strokeLinejoin="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />))}
          {hover !== null && <>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={height - padB} stroke="#94a3b8" strokeDasharray="3 3" />
            {series.map((s, si) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="3.5" fill={s.color ?? PALETTE[si % PALETTE.length]} />)}
          </>}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute right-2 top-1 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-xs shadow">
            <div className="font-medium">{labels[hover]}</div>
            {series.map((s, si) => <div key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color ?? PALETTE[si % PALETTE.length] }} />{s.name}: {s.values[hover]}{unit}</div>)}
          </div>)}
      </div>
      {series.length > 1 && <Legend items={series.map((s, i) => ({ name: s.name, color: s.color ?? PALETTE[i % PALETTE.length] }))} />}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">{items.map((i) => <span key={i.name} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.name}</span>)}</div>;
}

/** Horizontal bar list — good for rankings and long labels on mobile. */
export function BarList({ items, color = '#2f7bf5', unit = '' }: { items: { label: string; value: number; sub?: string }[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-0.5 flex justify-between gap-2 text-xs"><span className="truncate text-slate-700">{i.label}{i.sub && <span className="ml-1 text-slate-400">{i.sub}</span>}</span><span className="font-medium tabular-nums text-slate-900">{i.value}{unit}</span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} /></div>
        </li>))}
    </ul>
  );
}

/** Grouped columns: one group per category, one bar per series. */
export function ColumnChart({ categories, series, height = 220 }: { categories: string[]; series: Series[]; height?: number }) {
  const W = 640, padL = 32, padB = 40, padT = 10;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = Math.ceil(max / 4) * 4 || 4;
  const gw = (W - padL - 8) / categories.length;
  const bw = Math.min(28, (gw * 0.7) / series.length);
  const y = (v: number) => padT + (1 - v / nice) * (height - padT - padB);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Column chart">
        {[0, 1, 2, 3, 4].map((t) => (
          <g key={t}><line x1={padL} x2={W - 8} y1={y((nice * t) / 4)} y2={y((nice * t) / 4)} stroke="#e2e8f0" />
            <text x={padL - 5} y={y((nice * t) / 4) + 4} textAnchor="end" fontSize="10" fill="#64748b">{Math.round((nice * t) / 4)}</text></g>))}
        {categories.map((c, ci) => {
          const cx0 = padL + gw * ci + gw / 2;
          return (
            <g key={c}>
              {series.map((s, si) => {
                const v = s.values[ci];
                return <rect key={s.name} x={cx0 - (bw * series.length) / 2 + bw * si} y={y(v)} width={bw - 2} height={height - padB - y(v)} rx="2" fill={s.color ?? PALETTE[si % PALETTE.length]}><title>{`${c} — ${s.name}: ${v}`}</title></rect>;
              })}
              <text x={cx0} y={height - padB + 14} textAnchor="middle" fontSize="10" fill="#475569">{c}</text>
            </g>);
        })}
      </svg>
      {series.length > 1 && <Legend items={series.map((s, i) => ({ name: s.name, color: s.color ?? PALETTE[i % PALETTE.length] }))} />}
    </div>
  );
}

export function Gauge({ value, label }: { value: number; label: string }) {
  const tone = value >= 90 ? '#10b981' : value >= 75 ? '#f59e0b' : '#ef4444';
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 110 110" className="h-24 w-24 -rotate-90" role="img" aria-label={`${label} ${value}%`}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
        <text x="55" y="55" transform="rotate(90 55 55)" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="600" fill="#0f172a">{value}%</text>
      </svg>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
