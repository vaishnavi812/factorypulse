import { Badge, type Tone } from './ui';
import type { Incident, IncidentStatus, OrderStatus, Severity, SlaState, WorkCenterStatus } from '../types';
import { slaState } from '../lib/sla';
import { relTime } from '../lib/format';

const SEV: Record<Severity, Tone> = { Critical: 'red', High: 'amber', Medium: 'blue', Low: 'slate' };
export const SeverityBadge = ({ s }: { s: Severity }) => <Badge tone={SEV[s]}>{s}</Badge>;

const ST: Record<IncidentStatus, Tone> = { New: 'purple', Assigned: 'blue', 'In Progress': 'blue', 'Pending Info': 'amber', Resolved: 'green', Closed: 'slate' };
export const StatusBadge = ({ s }: { s: IncidentStatus }) => <Badge tone={ST[s]}>{s}</Badge>;

const SLA: Record<SlaState, Tone> = { 'On track': 'green', 'At risk': 'amber', Breached: 'red', Met: 'green' };
export function SlaBadge({ incident }: { incident: Incident }) {
  const s = slaState(incident);
  const open = s === 'On track' || s === 'At risk' || (s === 'Breached' && !incident.resolvedAt);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge tone={SLA[s]}>{s === 'Breached' ? '⚠ Breached' : s === 'At risk' ? '⏱ At risk' : s}</Badge>
      {open && <span className="text-[11px] text-slate-500">{relTime(incident.slaDeadline)}</span>}
    </span>
  );
}

const OS: Record<OrderStatus, Tone> = { Planned: 'slate', 'In Progress': 'blue', Blocked: 'red', Completed: 'green' };
export const OrderBadge = ({ s }: { s: OrderStatus }) => <Badge tone={OS[s]}>{s}</Badge>;
const WS: Record<WorkCenterStatus, Tone> = { Running: 'green', Idle: 'slate', Blocked: 'red', Maintenance: 'amber' };
export const WcBadge = ({ s }: { s: WorkCenterStatus }) => <Badge tone={WS[s]}>{s}</Badge>;
