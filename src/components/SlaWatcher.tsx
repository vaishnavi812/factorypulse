import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { services, subscribe } from '../services';
import { checkSla, type NotificationRecord } from '../services/notifications';

const INTERVAL_MS = 30_000;

/** Headless watcher: re-evaluates SLA state periodically and on data changes; shows a toast for new alerts. */
export function SlaWatcher() {
  const [toasts, setToasts] = useState<NotificationRecord[]>([]);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const created = await checkSla(await services.incidents.list());
        if (alive && created.length) { setToasts((t) => [...created, ...t].slice(0, 3)); setTimeout(() => alive && setToasts((t) => t.filter((x) => !created.includes(x))), 12_000); }
      } catch { /* backend unavailable: try again next tick */ }
    };
    run();
    const id = setInterval(run, INTERVAL_MS);
    const unsub = subscribe(() => { run(); });
    return () => { alive = false; clearInterval(id); unsub(); };
  }, []);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <Link key={t.key} to={`/incidents/${t.incidentId}`} className={`block rounded-lg border-l-4 bg-white p-3 text-sm shadow-lg ${t.kind === 'breached' ? 'border-red-500' : 'border-amber-500'}`}>
          <div className="font-semibold">{t.kind === 'breached' ? '🚨 SLA breached' : '⏱ SLA about to breach'} · {t.incidentId}</div>
          <div className="text-xs text-slate-500">{t.priority} · {t.factory} — email: {t.email}, Teams: {t.teams}</div>
        </Link>))}
    </div>
  );
}
