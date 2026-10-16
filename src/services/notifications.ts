import type { Incident } from '../types';
import { isOpen, slaState } from '../lib/sla';

export type AlertKind = 'at-risk' | 'breached';
export interface NotificationRecord {
  key: string; at: string; kind: AlertKind; incidentId: string; priority: string; factory: string;
  email: string; teams: string; // sent | dry-run | skipped | failed: … | notifier offline
  read: boolean;
}
export interface NotifierStatus { email: boolean; teams: boolean; dryRun: boolean }

const LOG_KEY = 'factorypulse.v1.notifLog';
const listeners = new Set<() => void>();
export const subscribeLog = (f: () => void) => (listeners.add(f), () => { listeners.delete(f); });
let cache: NotificationRecord[] | null = null;

export function getLog(): NotificationRecord[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]'); } catch { cache = []; }
  return cache!;
}
function setLog(l: NotificationRecord[]) {
  cache = l.slice(0, 200);
  try { localStorage.setItem(LOG_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  listeners.forEach((f) => f());
}
export const markAllRead = () => setLog(getLog().map((r) => ({ ...r, read: true })));
export const clearLog = () => setLog([]);

export async function getStatus(): Promise<NotifierStatus | null> {
  try { const r = await fetch('/api/notify/status'); return r.ok ? await r.json() : null; } catch { return null; }
}

async function send(kind: AlertKind, i: Incident): Promise<Pick<NotificationRecord, 'email' | 'teams'>> {
  try {
    const r = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, incident: i }) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return { email: 'notifier offline', teams: 'notifier offline' };
  }
}

let busy = false;
/** Sends one alert per incident per stage (at-risk, then breached). Returns newly created records. */
export async function checkSla(incidents: Incident[]): Promise<NotificationRecord[]> {
  if (busy) return [];
  busy = true;
  try {
    const created: NotificationRecord[] = [];
    for (const i of incidents.filter(isOpen)) {
      const s = slaState(i);
      if (s !== 'At risk' && s !== 'Breached') continue;
      const kind: AlertKind = s === 'Breached' ? 'breached' : 'at-risk';
      const key = `${i.id}:${kind}:${i.slaDeadline}`; // a changed deadline (priority change) re-arms the alert
      if (getLog().some((r) => r.key === key)) continue;
      const res = await send(kind, i);
      const rec: NotificationRecord = { key, at: new Date().toISOString(), kind, incidentId: i.id, priority: i.priority, factory: i.factory, ...res, read: false };
      setLog([rec, ...getLog()]);
      created.push(rec);
    }
    return created;
  } finally { busy = false; }
}
