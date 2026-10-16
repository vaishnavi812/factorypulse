import type { Incident, KnowledgeArticle, ShiftEntry, FactoryAlert, AuditEntry, User } from '../types';
import { SLA_HOURS } from '../data/reference';
import * as seed from '../data/seed';
import {
  NotConnectedAdapter, type AuditService, type IncidentService, type KnowledgeService, type ProductionService,
  type Services, type SessionService, type ShiftbookService,
} from './contracts';

const PREFIX = 'factorypulse.v1.';
const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => (listeners.add(fn), () => { listeners.delete(fn); });
const notify = () => listeners.forEach((l) => l());

/** Flag toggled from the sidebar to demonstrate error states. */
export const SIM_ERROR_KEY = PREFIX + 'simulateError';
export const SIM_SLOW_MS = 280;

const mem = new Map<string, unknown>();
function load<T>(key: string, make: () => T): T {
  if (mem.has(key)) return mem.get(key) as T;
  let value: T;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    value = raw ? (JSON.parse(raw) as T) : make();
    if (!raw) localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    value = make(); // storage blocked or corrupt → fall back to in-memory seed
  }
  mem.set(key, value);
  return value;
}
function save<T>(key: string, value: T) {
  mem.set(key, value);
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* quota/blocked: keep in memory */ }
  notify();
}

export function resetPrototypeData() {
  mem.clear();
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX) && k !== SIM_ERROR_KEY).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  notify();
}

async function latency<T>(fn: () => T): Promise<T> {
  await new Promise((r) => setTimeout(r, SIM_SLOW_MS));
  let fail = false;
  try { fail = localStorage.getItem(SIM_ERROR_KEY) === '1'; } catch { /* ignore */ }
  if (fail) throw new Error('Simulated backend error (503). Toggle “Simulate API error” in the sidebar to clear.');
  return structuredClone(fn());
}

const now = () => Date.now();
const user: User = { name: 'Demo User', role: 'MES Support' };

// ---- audit -----------------------------------------------------------------------------------
const audit = (action: string, entity: string, detail?: string) => {
  const list = load<AuditEntry[]>('audit', () => []);
  save('audit', [{ at: new Date().toISOString(), actor: user.name, action, entity, detail }, ...list].slice(0, 500));
};

// ---- incidents -------------------------------------------------------------------------------
const incidents: IncidentService = {
  list: () => latency(() => load<Incident[]>('incidents', () => seed.seedIncidents(now()))),
  get: (id) => latency(() => load<Incident[]>('incidents', () => seed.seedIncidents(now())).find((i) => i.id === id)),
  create: (input) => latency(() => {
    const list = load<Incident[]>('incidents', () => seed.seedIncidents(now()));
    const max = list.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, ''))), 2400);
    const created = new Date();
    const inc: Incident = {
      ...input, id: `INC-${max + 1}`, createdAt: created.toISOString(),
      slaDeadline: new Date(created.getTime() + SLA_HOURS[input.priority] * 3600_000).toISOString(),
      status: input.owner === 'Unassigned' ? 'New' : 'Assigned',
      history: [{ at: created.toISOString(), by: user.name, action: 'Incident created' }],
    };
    if (input.owner !== 'Unassigned') inc.history.push({ at: created.toISOString(), by: user.name, action: `Assigned to ${input.owner}` });
    save('incidents', [inc, ...list]);
    audit('incident.create', inc.id, `${inc.errorCode} @ ${inc.factory}`);
    return inc;
  }),
  update: (id, patch, note) => latency(() => {
    const list = load<Incident[]>('incidents', () => seed.seedIncidents(now()));
    const idx = list.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error(`Incident ${id} not found`);
    const cur = list[idx];
    const next: Incident = { ...cur, history: [...cur.history] };
    const at = new Date().toISOString();
    if (patch.owner && patch.owner !== cur.owner) {
      next.owner = patch.owner;
      next.history.push({ at, by: user.name, action: `Reassigned to ${patch.owner}` });
      if (cur.status === 'New' && patch.owner !== 'Unassigned') next.status = 'Assigned';
    }
    if (patch.priority && patch.priority !== cur.priority) {
      next.priority = patch.priority;
      next.slaDeadline = new Date(new Date(cur.createdAt).getTime() + SLA_HOURS[patch.priority] * 3600_000).toISOString();
      next.history.push({ at, by: user.name, action: `Priority → ${patch.priority}`, note: 'SLA deadline recalculated.' });
    }
    if (patch.status && patch.status !== cur.status) {
      const closing = patch.status === 'Resolved' || patch.status === 'Closed';
      if (closing && !(patch.resolutionNotes ?? cur.resolutionNotes)?.trim()) throw new Error('Resolution notes are required to resolve or close an incident.');
      next.status = patch.status;
      if (closing && !cur.resolvedAt) next.resolvedAt = at;
      if (!closing) { next.resolvedAt = undefined; }
      next.history.push({ at, by: user.name, action: `Status → ${patch.status}`, note });
    } else if (note) {
      next.history.push({ at, by: user.name, action: 'Comment added', note });
    }
    if (patch.description) next.description = patch.description;
    if (patch.resolutionNotes !== undefined) next.resolutionNotes = patch.resolutionNotes;
    list[idx] = next;
    save('incidents', [...list]);
    audit('incident.update', id, Object.keys(patch).join(','));
    return next;
  }),
};

// ---- production ------------------------------------------------------------------------------
const production: ProductionService = {
  listOrders: () => latency(() => load('orders', () => seed.seedOrders(now()))),
  listWorkCenters: () => latency(() => load('workCenters', seed.seedWorkCenters)),
  listAlerts: () => latency(() => load<FactoryAlert[]>('alerts', () => seed.seedAlerts(now()))),
  resolveAlert: (id) => latency(() => {
    const list = load<FactoryAlert[]>('alerts', () => seed.seedAlerts(now()));
    save('alerts', list.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
    audit('alert.resolve', id);
  }),
  listDowntime: () => latency(() => load('downtime', () => seed.seedDowntime(now()))),
};

// ---- shiftbook -------------------------------------------------------------------------------
const shiftbook: ShiftbookService = {
  list: () => latency(() => load<ShiftEntry[]>('shifts', () => seed.seedShifts(now()))),
  create: (entry) => latency(() => {
    const list = load<ShiftEntry[]>('shifts', () => seed.seedShifts(now()));
    const e: ShiftEntry = { ...entry, id: `SH-${Date.now().toString(36).toUpperCase()}`, createdAt: new Date().toISOString() };
    save('shifts', [e, ...list]);
    audit('shift.create', e.id, `${e.factory} ${e.shift}`);
    return e;
  }),
  setTaskDone: (entryId, taskId, done) => latency(() => {
    const list = load<ShiftEntry[]>('shifts', () => seed.seedShifts(now()));
    save('shifts', list.map((s) => s.id !== entryId ? s : { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) }));
    audit('shift.task', `${entryId}/${taskId}`, done ? 'done' : 'reopened');
  }),
};

// ---- knowledge -------------------------------------------------------------------------------
const knowledge: KnowledgeService = {
  list: () => latency(() => load<KnowledgeArticle[]>('kb', () => seed.seedKnowledge(now()))),
  save: (a) => latency(() => {
    const list = load<KnowledgeArticle[]>('kb', () => seed.seedKnowledge(now()));
    const updatedAt = new Date().toISOString();
    if (a.id) {
      const saved = { ...a, id: a.id, updatedAt } as KnowledgeArticle;
      save('kb', list.map((x) => (x.id === a.id ? saved : x)));
      audit('kb.update', a.id);
      return saved;
    }
    const max = list.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, ''))), 0);
    const saved = { ...a, id: `KB-${String(max + 1).padStart(4, '0')}`, updatedAt } as KnowledgeArticle;
    save('kb', [...list, saved]);
    audit('kb.create', saved.id);
    return saved;
  }),
  remove: (id) => latency(() => {
    save('kb', load<KnowledgeArticle[]>('kb', () => seed.seedKnowledge(now())).filter((x) => x.id !== id));
    audit('kb.delete', id);
  }),
};

const auditSvc: AuditService = { list: () => latency(() => load<AuditEntry[]>('audit', () => [])) };
const session: SessionService = { currentUser: () => user };

export const services: Services = {
  incidents, production, shiftbook, knowledge, audit: auditSvc, session, adapter: NotConnectedAdapter,
};
