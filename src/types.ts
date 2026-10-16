export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type IncidentStatus = 'New' | 'Assigned' | 'In Progress' | 'Pending Info' | 'Resolved' | 'Closed';
export type SlaState = 'On track' | 'At risk' | 'Breached' | 'Met';

export interface HistoryEntry {
  at: string; // ISO
  by: string;
  action: string;
  note?: string;
}

export interface Incident {
  id: string;
  factory: string;
  application: string;
  workCenter: string;
  errorCode: string;
  description: string;
  priority: Severity;
  owner: string;
  status: IncidentStatus;
  createdAt: string;
  slaDeadline: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  history: HistoryEntry[];
}

export type NewIncident = Pick<
  Incident,
  'factory' | 'application' | 'workCenter' | 'errorCode' | 'description' | 'priority' | 'owner'
>;

export type WorkCenterStatus = 'Running' | 'Idle' | 'Blocked' | 'Maintenance';
export interface WorkCenter {
  id: string;
  factory: string;
  name: string;
  status: WorkCenterStatus;
  blockReason?: string;
}

export type OrderStatus = 'Planned' | 'In Progress' | 'Blocked' | 'Completed';
export interface ProductionOrder {
  id: string;
  factory: string;
  workCenter: string;
  product: string;
  planned: number;
  produced: number;
  status: OrderStatus;
  downtimeMin: number;
  start: string;
  plannedEnd: string;
  blockReason?: string;
}

export interface FactoryAlert {
  id: string;
  factory: string;
  workCenter: string;
  severity: Severity;
  message: string;
  raisedAt: string;
  resolved: boolean;
}

export interface DowntimeRecord {
  date: string; // yyyy-mm-dd
  factory: string;
  minutes: number;
}

export interface FollowUpTask {
  id: string;
  text: string;
  assignee: string;
  due: string; // yyyy-mm-dd
  done: boolean;
}
export type ShiftName = 'Early' | 'Late' | 'Night';
export interface ShiftEntry {
  id: string;
  factory: string;
  shift: ShiftName;
  date: string; // yyyy-mm-dd
  author: string;
  productionStatus: string;
  machineProblems: string;
  tasks: FollowUpTask[];
  createdAt: string;
}

export interface KnowledgeArticle {
  id: string; // KB-0001
  errorCode: string;
  title: string;
  category: string;
  symptoms: string;
  rootCause: string;
  solution: string[];
  docLink: string;
  sourceDoc: string;
  tags: string[];
  approved: boolean;
  updatedAt: string;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  entity: string;
  detail?: string;
}

export interface User { name: string; role: 'Factory User' | 'MES Support' | 'Production Manager'; }
