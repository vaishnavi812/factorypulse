import type {
  Incident, Severity, IncidentStatus, WorkCenter, ProductionOrder, FactoryAlert, DowntimeRecord,
  ShiftEntry, KnowledgeArticle, HistoryEntry,
} from '../types';
import { FACTORIES, SLA_HOURS, WORK_CENTERS } from './reference';

const H = 3600_000;
const D = 24 * H;
const iso = (t: number) => new Date(t).toISOString();
const day = (t: number) => iso(t).slice(0, 10);

// Deterministic PRNG so the sample data is stable between reloads / resets.
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export function seedKnowledge(now: number): KnowledgeArticle[] {
  const u = (d: number) => iso(now - d * D);
  const mk = (n: number, a: Omit<KnowledgeArticle, 'id' | 'approved' | 'updatedAt'> & { age?: number }): KnowledgeArticle => ({
    id: `KB-${String(n).padStart(4, '0')}`, approved: true, updatedAt: u(a.age ?? n * 9), ...a,
  });
  return [
    mk(1, { errorCode: 'MES-1001', title: 'Terminal cannot reach MES application server', category: 'Connectivity',
      symptoms: 'Operator terminal shows "Connection lost" banner; confirmations are not saved; screen frozen after login.',
      rootCause: 'Network switch port flapping or expired client certificate on the shopfloor terminal.',
      solution: ['Ping the MES gateway from the terminal; if it fails, check the cabinet switch port LED.', 'Check client certificate expiry in terminal settings; renew via the device management tool if expired.', 'Restart the terminal kiosk service and log in again.', 'If the issue persists for more than 15 minutes, escalate to the network team with the terminal asset tag.'],
      docLink: 'https://intranet.example.com/mes/kb/connectivity-terminal', sourceDoc: 'MES Operations Runbook v4.2, §3.1', tags: ['terminal', 'network', 'certificate', 'connection lost'] }),
    mk(2, { errorCode: 'MES-1042', title: 'Production confirmation rejected: quantity exceeds order tolerance', category: 'Data Integrity',
      symptoms: 'Operator confirmation fails with message "Over-delivery tolerance exceeded"; order stays open.',
      rootCause: 'Confirmed yield plus previous confirmations exceeds the over-delivery tolerance configured on the order.',
      solution: ['Verify previously confirmed quantities in the order history for duplicates.', 'If a duplicate exists, request cancellation of the duplicate confirmation from MES support.', 'If the quantity is genuine, request a tolerance change approved by the production planner.', 'Re-submit the confirmation after the change is recorded.'],
      docLink: 'https://intranet.example.com/mes/kb/confirmation-tolerance', sourceDoc: 'Production Confirmation Guide, §5.4', tags: ['confirmation', 'quantity', 'tolerance', 'over-delivery', 'order'] }),
    mk(3, { errorCode: 'MES-2007', title: 'Label printer returns spool error / no label printed', category: 'Printing',
      symptoms: 'Print job accepted but no label is output; print queue shows status "Error"; blinking printer LED.',
      rootCause: 'Printer offline, ribbon/label stock empty, or stale job blocking the print queue.',
      solution: ['Check label stock and ribbon; reload if empty and press Feed.', 'Clear the stale job from the print queue in the label service console.', 'Reprint the label from the order screen; verify the template version matches the product.', 'If the printer remains offline, switch to the backup printer in the work center profile.'],
      docLink: 'https://intranet.example.com/mes/kb/label-printing', sourceDoc: 'Label Printing Troubleshooting Sheet, rev C', tags: ['label', 'printer', 'spool', 'ribbon', 'queue'] }),
    mk(4, { errorCode: 'MES-2015', title: 'Serial number label barcode fails scan at packing', category: 'Printing',
      symptoms: 'Scanner at packing cannot read the serial label; downstream station rejects the unit.',
      rootCause: 'Print head dirty or darkness setting too low; wrong label template scaling.',
      solution: ['Clean the print head with isopropyl wipes.', 'Raise print darkness by one step and print a test label.', 'Confirm the template scaling is 100% in the label service.', 'Scrap unreadable labels and log them in the shiftbook.'],
      docLink: 'https://intranet.example.com/mes/kb/barcode-quality', sourceDoc: 'Label Printing Troubleshooting Sheet, rev C', tags: ['barcode', 'scan', 'serial', 'label', 'print head'] }),
    mk(5, { errorCode: 'MES-3003', title: 'Machine interface: no cycle data received', category: 'Connectivity',
      symptoms: 'Work center shows no cycle counts for more than 10 minutes while the machine is running; OEE dashboard flatlines.',
      rootCause: 'Machine gateway service stopped, or PLC tag mapping changed after a firmware update.',
      solution: ['Check the machine gateway service status on the edge server and restart it if stopped.', 'Compare PLC tag addresses with the mapping table; correct any changed tags.', 'Confirm cycle counters resume in the monitoring view within two cycles.', 'Back-fill missed counts through a manual confirmation approved by the shift lead.'],
      docLink: 'https://intranet.example.com/mes/kb/machine-gateway', sourceDoc: 'Machine Integration Handbook, §2.7', tags: ['plc', 'gateway', 'cycle', 'oee', 'no data', 'machine'] }),
    mk(6, { errorCode: 'MES-3021', title: 'Duplicate machine events creating inflated counts', category: 'Data Integrity',
      symptoms: 'Produced quantity increases faster than machine cycles; duplicate event IDs in the interface log.',
      rootCause: 'Gateway retry after timeout delivers the same event twice because deduplication is disabled.',
      solution: ['Enable the event de-duplication flag in the gateway profile.', 'Identify affected time window from the interface log.', 'Request correction of confirmed quantities via MES support with the event IDs.'],
      docLink: 'https://intranet.example.com/mes/kb/duplicate-events', sourceDoc: 'Machine Integration Handbook, §4.2', tags: ['duplicate', 'events', 'quantity', 'retry', 'gateway'] }),
    mk(7, { errorCode: 'MES-4010', title: 'Quality inspection plan not found for material', category: 'Quality',
      symptoms: 'Operator cannot start inspection; error "No inspection plan assigned".',
      rootCause: 'Material master lacks a valid inspection plan assignment for the plant, or plan validity has expired.',
      solution: ['Confirm the material number and plant on the inspection screen.', 'Ask quality engineering to verify the inspection plan assignment and validity dates.', 'After correction, refresh the master data cache from the admin menu.'],
      docLink: 'https://intranet.example.com/mes/kb/inspection-plan', sourceDoc: 'Quality Management Work Instruction QM-12', tags: ['inspection', 'plan', 'quality', 'material master'] }),
    mk(8, { errorCode: 'MES-4022', title: 'Inspection result cannot be saved: characteristic out of range', category: 'Quality',
      symptoms: 'Result entry rejected with "Value outside permitted range"; lot is blocked from release.',
      rootCause: 'Measured value is genuinely out of tolerance, or unit of measure mismatch between gauge and characteristic.',
      solution: ['Check the unit of measure on the gauge and characteristic.', 'Re-measure with a calibrated gauge.', 'If out of tolerance, record the defect and initiate the non-conformance process.', 'Do not override the limit without quality engineer approval.'],
      docLink: 'https://intranet.example.com/mes/kb/inspection-range', sourceDoc: 'Quality Management Work Instruction QM-15', tags: ['inspection', 'range', 'tolerance', 'defect', 'lot'] }),
    mk(9, { errorCode: 'MES-5005', title: 'Material staging: component batch not available', category: 'Material',
      symptoms: 'Order cannot start; staging screen reports "Batch not available" although stock is physically present.',
      rootCause: 'Goods receipt not posted in the system, or batch status is blocked/quarantined.',
      solution: ['Verify goods receipt posting for the batch with the warehouse team.', 'Check batch status; quarantined batches need quality release.', 'Re-scan the batch after the status changes.', 'Document the material delay in the shiftbook and notify the production planner.'],
      docLink: 'https://intranet.example.com/mes/kb/material-batch', sourceDoc: 'Material Tracking Guide, §6.1', tags: ['batch', 'staging', 'goods receipt', 'quarantine', 'material'] }),
    mk(10, { errorCode: 'MES-5018', title: 'Container / pallet ID already in use', category: 'Material',
      symptoms: 'Scanning a pallet label returns "ID already assigned".',
      rootCause: 'Pallet label reused or previous pallet record not closed.',
      solution: ['Look up the pallet ID in Material Tracking and check its open assignment.', 'Close the previous assignment if the pallet is empty.', 'If the label is a true duplicate, print a new pallet ID and scrap the old label.'],
      docLink: 'https://intranet.example.com/mes/kb/pallet-id', sourceDoc: 'Material Tracking Guide, §7.3', tags: ['pallet', 'container', 'duplicate', 'scan'] }),
    mk(11, { errorCode: 'MES-6001', title: 'MES application slow response / timeouts', category: 'Performance',
      symptoms: 'Screens take longer than 10 seconds to load; sporadic "Request timed out" errors across several terminals.',
      rootCause: 'Database connection pool exhaustion or long-running report job during production hours.',
      solution: ['Check the application server dashboard for connection pool saturation.', 'Identify and pause long-running report jobs scheduled in production hours.', 'Recycle the application pool in a controlled window if saturation continues.', 'Open a problem record to reschedule heavy jobs.'],
      docLink: 'https://intranet.example.com/mes/kb/performance', sourceDoc: 'MES Operations Runbook v4.2, §6.4', tags: ['slow', 'timeout', 'performance', 'database', 'pool'] }),
    mk(12, { errorCode: 'MES-7002', title: 'User lacks authorization for operation', category: 'Authorization',
      symptoms: 'Action greyed out or "Not authorized" message for a function the user should have.',
      rootCause: 'Role assignment missing for the plant or work center, or role change not yet synchronized.',
      solution: ['Confirm the user\'s role and plant assignment in the identity portal.', 'Request the missing role through the approved access request workflow.', 'Have the user log out and in after the sync completes.'],
      docLink: 'https://intranet.example.com/mes/kb/authorization', sourceDoc: 'Access Management Policy AM-03', tags: ['authorization', 'role', 'access', 'permission'] }),
    mk(13, { errorCode: 'MES-1090', title: 'Shift calendar missing for work center', category: 'Data Integrity',
      symptoms: 'Planned capacity shows zero; the scheduling view shows no shift slots for the day.',
      rootCause: 'Factory calendar was not extended for the new period.',
      solution: ['Ask the master data team to extend the factory calendar and shift model.', 'Refresh the scheduling cache.', 'Verify the shift slots appear for the next 4 weeks.'],
      docLink: 'https://intranet.example.com/mes/kb/shift-calendar', sourceDoc: 'Master Data Handbook, §1.5', tags: ['calendar', 'shift', 'capacity', 'master data'] }),
    { ...mk(14, { errorCode: 'MES-8001', title: 'Draft: Intermittent scanner disconnects on Bluetooth handhelds', category: 'Connectivity',
      symptoms: 'Handheld scanners drop pairing every few minutes.', rootCause: 'Under investigation.',
      solution: ['Collect device firmware versions.', 'Report to MES support with the device list.'],
      docLink: 'https://intranet.example.com/mes/kb/draft-bluetooth', sourceDoc: 'Draft — not yet reviewed', tags: ['scanner', 'bluetooth', 'handheld'] }), approved: false },
  ];
}

export function seedWorkCenters(): WorkCenter[] {
  const blocked: Record<string, string> = {
    'MTY-WLD-01': 'Awaiting weld wire batch release',
    'PUN-MCH-02': 'Spindle fault — maintenance called',
  };
  const maint = ['GDN-CST-01'];
  const idle = ['STU-PNT-01', 'PUN-PKG-01'];
  return FACTORIES.flatMap((f) =>
    WORK_CENTERS[f].map<WorkCenter>((name) => ({
      id: name, factory: f, name,
      status: blocked[name] ? 'Blocked' : maint.includes(name) ? 'Maintenance' : idle.includes(name) ? 'Idle' : 'Running',
      blockReason: blocked[name],
    })),
  );
}

export function seedOrders(now: number): ProductionOrder[] {
  const o = (id: string, factory: string, wc: string, product: string, planned: number, produced: number,
    status: ProductionOrder['status'], downtimeMin: number, startH: number, endH: number, blockReason?: string): ProductionOrder => ({
    id, factory, workCenter: wc, product, planned, produced, status, downtimeMin,
    start: iso(now - startH * H), plannedEnd: iso(now + endH * H), blockReason,
  });
  return [
    o('PO-100231', 'Stuttgart', 'STU-ASM-01', 'Gearbox housing G12', 480, 312, 'In Progress', 22, 14, 10),
    o('PO-100232', 'Stuttgart', 'STU-ASM-02', 'Drive unit DU-4', 220, 205, 'In Progress', 8, 18, 3),
    o('PO-100233', 'Stuttgart', 'STU-WLD-01', 'Frame weldment W7', 150, 150, 'Completed', 35, 30, -6),
    o('PO-100234', 'Stuttgart', 'STU-PNT-01', 'Panel cover PC-2', 600, 0, 'Planned', 0, -6, 30),
    o('PO-100301', 'Pune', 'PUN-MCH-01', 'Shaft S-18', 900, 610, 'In Progress', 41, 20, 8),
    o('PO-100302', 'Pune', 'PUN-MCH-02', 'Rotor R-9', 400, 118, 'Blocked', 190, 16, 5, 'Spindle fault — maintenance called'),
    o('PO-100303', 'Pune', 'PUN-ASM-01', 'Pump assembly PA-3', 260, 172, 'In Progress', 15, 12, 7),
    o('PO-100304', 'Pune', 'PUN-PKG-01', 'Pump kit PK-3', 260, 260, 'Completed', 5, 26, -2),
    o('PO-100411', 'Monterrey', 'MTY-STP-01', 'Bracket BR-21', 2400, 1980, 'In Progress', 30, 22, 4),
    o('PO-100412', 'Monterrey', 'MTY-WLD-01', 'Chassis rail CR-5', 320, 64, 'Blocked', 240, 15, 6, 'Awaiting weld wire batch release'),
    o('PO-100413', 'Monterrey', 'MTY-ASM-01', 'Seat frame SF-8', 500, 205, 'In Progress', 18, 16, 14),
    o('PO-100414', 'Monterrey', 'MTY-TST-01', 'Seat frame SF-8 (EOL test)', 500, 90, 'In Progress', 52, 10, 20),
    o('PO-100521', 'Gdańsk', 'GDN-CST-01', 'Valve body VB-6', 700, 280, 'In Progress', 95, 20, 9),
    o('PO-100522', 'Gdańsk', 'GDN-MCH-01', 'Valve seat VS-2', 700, 455, 'In Progress', 12, 14, 8),
    o('PO-100523', 'Gdańsk', 'GDN-ASM-01', 'Valve assembly VA-1', 350, 0, 'Planned', 0, -10, 40),
    o('PO-100524', 'Gdańsk', 'GDN-PKG-01', 'Valve crate VC-1', 350, 120, 'In Progress', 10, 9, 12),
  ];
}

export function seedAlerts(now: number): FactoryAlert[] {
  const a = (n: number, factory: string, workCenter: string, severity: Severity, message: string, ageH: number, resolved = false): FactoryAlert =>
    ({ id: `AL-${900 + n}`, factory, workCenter, severity, message, raisedAt: iso(now - ageH * H), resolved });
  return [
    a(1, 'Pune', 'PUN-MCH-02', 'Critical', 'Spindle vibration above limit — machine stopped', 5),
    a(2, 'Monterrey', 'MTY-WLD-01', 'High', 'Weld wire batch not released by quality', 6),
    a(3, 'Gdańsk', 'GDN-CST-01', 'Medium', 'Furnace temperature drift detected', 3),
    a(4, 'Stuttgart', 'STU-ASM-01', 'Low', 'Torque tool calibration due in 3 days', 20),
    a(5, 'Monterrey', 'MTY-TST-01', 'High', 'EOL tester reporting repeated retests', 2),
    a(6, 'Pune', 'PUN-PKG-01', 'Low', 'Packaging film roll low', 8, true),
    a(7, 'Stuttgart', 'STU-WLD-01', 'Medium', 'Weld fume extraction filter pressure high', 30, true),
    a(8, 'Gdańsk', 'GDN-PKG-01', 'Medium', 'Label printer offline', 1),
  ];
}

export function seedDowntime(now: number): DowntimeRecord[] {
  const r = rng(42);
  const base: Record<string, number> = { Stuttgart: 70, Pune: 130, Monterrey: 110, 'Gdańsk': 85 };
  const out: DowntimeRecord[] = [];
  for (let d = 89; d >= 0; d--) {
    for (const f of FACTORIES) {
      const trend = f === 'Pune' && d < 14 ? 1.35 : 1; // Pune downtime rising recently
      out.push({ date: day(now - d * D), factory: f, minutes: Math.round(base[f] * trend * (0.5 + r())) });
    }
  }
  return out;
}

const APP_FOR_CODE: Record<string, string> = {
  'MES-1001': 'Operator Terminal', 'MES-1042': 'MES Core', 'MES-2007': 'Label Printing', 'MES-2015': 'Label Printing',
  'MES-3003': 'Machine Integration', 'MES-3021': 'Machine Integration', 'MES-4010': 'Quality Management',
  'MES-4022': 'Quality Management', 'MES-5005': 'Material Tracking', 'MES-5018': 'Material Tracking',
  'MES-6001': 'MES Core', 'MES-7002': 'MES Core',
};
const DESC: Record<string, string[]> = {
  'MES-1001': ['Terminal shows connection lost banner after login', 'Confirmations not saved, terminal frozen'],
  'MES-1042': ['Confirmation rejected: over-delivery tolerance exceeded', 'Cannot confirm final lot, tolerance error'],
  'MES-2007': ['Label printer spool error, no label printed', 'Print queue stuck in error state'],
  'MES-2015': ['Serial label barcode not scannable at packing', 'Scanner rejects serial label'],
  'MES-3003': ['No cycle data received from machine for 20 minutes', 'OEE dashboard flatlined while machine runs'],
  'MES-3021': ['Produced quantity counting twice per cycle', 'Duplicate machine events in interface log'],
  'MES-4010': ['No inspection plan assigned to material', 'Operator cannot start inspection'],
  'MES-4022': ['Inspection value rejected as out of range', 'Result cannot be saved, lot blocked'],
  'MES-5005': ['Batch not available at staging although stock present', 'Cannot stage components for order'],
  'MES-5018': ['Pallet ID already in use when scanning', 'Container label already assigned'],
  'MES-6001': ['Screens slow, request timed out on several terminals', 'MES very slow during shift change'],
  'MES-7002': ['User not authorized to confirm operation', 'Not authorized message for released role'],
};
const OWNERS_REAL = ['A. Weber', 'P. Deshmukh', 'L. Herrera', 'M. Kowalski', 'S. Iyer', 'J. Becker'];

export function seedIncidents(now: number): Incident[] {
  const r = rng(7);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const codes = Object.keys(APP_FOR_CODE);
  // Weighted so some errors recur (Pareto-like).
  const weighted = [...codes, 'MES-3003', 'MES-3003', 'MES-2007', 'MES-2007', 'MES-1001', 'MES-1001', 'MES-1042', 'MES-5005'];
  const sev: Severity[] = ['Critical', 'High', 'High', 'Medium', 'Medium', 'Medium', 'Low', 'Low'];
  const out: Incident[] = [];
  const total = 64;
  for (let i = 0; i < total; i++) {
    const code = pick(weighted);
    const factory = i % 5 === 0 ? 'Pune' : pick(FACTORIES);
    const priority = pick(sev);
    // Newest incidents are most likely still open.
    const ageH = i < 14 ? SLA_HOURS[priority] * (0.1 + r() * 1.05) : r() * 24 * 60; // fresh incidents sit inside/near their SLA window
    const createdAt = now - ageH * H;
    const slaDeadline = createdAt + SLA_HOURS[priority] * H;
    const open = i < 14; // older incidents are all concluded
    let status: IncidentStatus;
    let resolvedAt: number | undefined;
    const owner = r() < 0.08 ? 'Unassigned' : pick(OWNERS_REAL);
    const history: HistoryEntry[] = [{ at: iso(createdAt), by: 'Service Desk', action: 'Incident created' }];
    if (open) {
      status = owner === 'Unassigned' ? 'New' : pick<IncidentStatus>(['Assigned', 'In Progress', 'In Progress', 'Pending Info']);
      if (owner !== 'Unassigned') history.push({ at: iso(createdAt + 0.2 * H), by: 'Service Desk', action: `Assigned to ${owner}` });
      if (status === 'In Progress') history.push({ at: iso(createdAt + 0.6 * H), by: owner, action: 'Status → In Progress', note: 'Analysis started, checking logs.' });
      if (status === 'Pending Info') history.push({ at: iso(createdAt + 0.8 * H), by: owner, action: 'Status → Pending Info', note: 'Requested screenshots from the shift lead.' });
    } else {
      // Resolution time: mostly within SLA, ~18% late
      const late = r() < 0.18;
      const dur = SLA_HOURS[priority] * H * (late ? 1.1 + r() * 0.8 : 0.15 + r() * 0.8);
      resolvedAt = createdAt + dur;
      if (resolvedAt > now) resolvedAt = now - 0.5 * H;
      status = r() < 0.7 ? 'Closed' : 'Resolved';
      history.push({ at: iso(createdAt + 0.3 * H), by: 'Service Desk', action: `Assigned to ${owner}` });
      history.push({ at: iso(resolvedAt), by: owner, action: `Status → ${status}`, note: 'Resolved following KB article.' });
    }
    out.push({
      id: `INC-${2400 + i}`,
      factory, application: APP_FOR_CODE[code], workCenter: pick(WORK_CENTERS[factory]), errorCode: code,
      description: pick(DESC[code]), priority, owner, status,
      createdAt: iso(createdAt), slaDeadline: iso(slaDeadline),
      resolvedAt: resolvedAt ? iso(resolvedAt) : undefined,
      resolutionNotes: resolvedAt ? `Applied the approved resolution for ${code}. Verified with the operator; no recurrence during the shift.` : undefined,
      history,
    });
  }
  // Hand-crafted examples guaranteeing visible SLA states on first launch.
  const fix = (idx: number, patch: Partial<Incident>) => {
    Object.assign(out[idx], patch);
    if (patch.createdAt) out[idx].history[0].at = patch.createdAt;
  };
  fix(0, { priority: 'Critical', status: 'In Progress', owner: 'P. Deshmukh', factory: 'Pune', workCenter: 'PUN-MCH-02', errorCode: 'MES-3003', application: 'Machine Integration', description: 'No cycle data received from rotor machine since spindle restart', createdAt: iso(now - 5 * H), slaDeadline: iso(now - 1 * H) });
  fix(1, { priority: 'High', status: 'Assigned', owner: 'L. Herrera', factory: 'Monterrey', workCenter: 'MTY-WLD-01', errorCode: 'MES-5005', application: 'Material Tracking', description: 'Batch not available at staging although stock present', createdAt: iso(now - 7 * H), slaDeadline: iso(now + 1 * H) });
  fix(2, { priority: 'Medium', status: 'In Progress', owner: 'M. Kowalski', factory: 'Gdańsk', workCenter: 'GDN-PKG-01', errorCode: 'MES-2007', application: 'Label Printing', description: 'Label printer spool error, no label printed', createdAt: iso(now - 20 * H), slaDeadline: iso(now + 4 * H) });
  return out;
}

export function seedShifts(now: number): ShiftEntry[] {
  const t = (n: number, text: string, assignee: string, dueD: number, done = false) =>
    ({ id: `T-${n}`, text, assignee, due: day(now + dueD * D), done });
  const s = (n: number, factory: string, shift: ShiftEntry['shift'], daysAgo: number, author: string, ps: string, mp: string, tasks: ShiftEntry['tasks']): ShiftEntry =>
    ({ id: `SH-${n}`, factory, shift, date: day(now - daysAgo * D), author, productionStatus: ps, machineProblems: mp, tasks, createdAt: iso(now - daysAgo * D) });
  return [
    s(1, 'Pune', 'Night', 0, 'R. Nair', 'PO-100301 at 68% of plan. PO-100302 stopped since 02:10 due to spindle fault.',
      'PUN-MCH-02 spindle vibration alarm; vendor technician called.',
      [t(1, 'Confirm spindle bearing replacement ETA with vendor', 'S. Iyer', 0), t(2, 'Re-sequence PO-100302 on PUN-MCH-01 if repair > 8h', 'P. Deshmukh', 0), t(3, 'Calibrate torque tool at PUN-ASM-01', 'R. Nair', 2, true)]),
    s(2, 'Monterrey', 'Late', 1, 'C. Ortega', 'Stamping on target. Welding blocked waiting on wire batch release.',
      'MTY-TST-01 EOL tester retests above 6%.',
      [t(4, 'Chase quality release for weld wire batch WB-5521', 'L. Herrera', 0), t(5, 'Inspect EOL tester fixtures for wear', 'C. Ortega', 1)]),
    s(3, 'Stuttgart', 'Early', 1, 'K. Fischer', 'PO-100231 slightly behind (65%). Paint line idle by plan.',
      'No machine problems. Minor label printer paper jam at STU-ASM-02.',
      [t(6, 'Order spare label rolls for STU-ASM-02', 'A. Weber', -1)]),
    s(4, 'Gdańsk', 'Night', 2, 'T. Nowak', 'Casting furnace output reduced 10%.',
      'Furnace temperature drift GDN-CST-01; maintenance planned next shift.',
      [t(7, 'Furnace thermocouple replacement', 'M. Kowalski', 1), t(8, 'Update shiftbook after maintenance', 'T. Nowak', 1)]),
  ];
}
