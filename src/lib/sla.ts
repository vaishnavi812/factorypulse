import type { Incident, SlaState } from '../types';

export const isOpen = (i: Incident) => i.status !== 'Resolved' && i.status !== 'Closed';
const AT_RISK_FRACTION = 0.25; // last 25% of the SLA window

export function slaState(i: Incident, now = Date.now()): SlaState {
  const deadline = new Date(i.slaDeadline).getTime();
  if (!isOpen(i)) return i.resolvedAt && new Date(i.resolvedAt).getTime() > deadline ? 'Breached' : 'Met';
  if (now > deadline) return 'Breached';
  const total = deadline - new Date(i.createdAt).getTime();
  return deadline - now <= total * AT_RISK_FRACTION ? 'At risk' : 'On track';
}

export function resolutionHours(i: Incident): number | undefined {
  return i.resolvedAt ? (new Date(i.resolvedAt).getTime() - new Date(i.createdAt).getTime()) / 3600_000 : undefined;
}
