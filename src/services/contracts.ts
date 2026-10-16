/**
 * Service contracts. UI code depends ONLY on these interfaces (see services/index.ts).
 * The prototype ships local, localStorage-backed implementations (services/local.ts).
 * To integrate real systems, implement the same interfaces with an HTTP client that talks to
 * a backend-for-frontend (BFF) — never call SAP or shopfloor systems directly from the browser.
 * See docs/INTEGRATION.md.
 */
import type {
  AuditEntry, DowntimeRecord, FactoryAlert, Incident, IncidentStatus, KnowledgeArticle, NewIncident,
  ProductionOrder, ShiftEntry, User, WorkCenter,
} from '../types';

export interface IncidentPatch {
  owner?: string;
  status?: IncidentStatus;
  priority?: Incident['priority'];
  description?: string;
  resolutionNotes?: string;
}

export interface IncidentService {
  list(): Promise<Incident[]>;
  get(id: string): Promise<Incident | undefined>;
  create(input: NewIncident): Promise<Incident>;
  /** `note` is stored in the incident history (required when moving to Resolved/Closed). */
  update(id: string, patch: IncidentPatch, note?: string): Promise<Incident>;
}

export interface ProductionService {
  listOrders(): Promise<ProductionOrder[]>;
  listWorkCenters(): Promise<WorkCenter[]>;
  listAlerts(): Promise<FactoryAlert[]>;
  resolveAlert(id: string): Promise<void>;
  listDowntime(): Promise<DowntimeRecord[]>;
}

export interface ShiftbookService {
  list(): Promise<ShiftEntry[]>;
  create(entry: Omit<ShiftEntry, 'id' | 'createdAt'>): Promise<ShiftEntry>;
  setTaskDone(entryId: string, taskId: string, done: boolean): Promise<void>;
}

export interface KnowledgeService {
  list(): Promise<KnowledgeArticle[]>;
  save(article: Omit<KnowledgeArticle, 'id' | 'updatedAt'> & { id?: string }): Promise<KnowledgeArticle>;
  remove(id: string): Promise<void>;
}

export interface AuditService {
  list(): Promise<AuditEntry[]>;
}

export interface SessionService {
  currentUser(): User;
}

/**
 * Outbound integration port for manufacturing systems (SAP MES / SAP ERP / other).
 * NOT implemented in the prototype — `NotConnectedAdapter` documents that explicitly.
 */
export interface ManufacturingSystemAdapter {
  readonly name: string;
  readonly connected: boolean;
  fetchProductionOrders(since: Date): Promise<ProductionOrder[]>;
  fetchWorkCenterStatus(): Promise<WorkCenter[]>;
  pushIncidentUpdate(incident: Incident): Promise<{ externalRef: string }>;
}

export const NotConnectedAdapter: ManufacturingSystemAdapter = {
  name: 'None (mock data only)',
  connected: false,
  fetchProductionOrders: () => Promise.reject(new Error('No manufacturing system connected')),
  fetchWorkCenterStatus: () => Promise.reject(new Error('No manufacturing system connected')),
  pushIncidentUpdate: () => Promise.reject(new Error('No manufacturing system connected')),
};

export interface Services {
  incidents: IncidentService;
  production: ProductionService;
  shiftbook: ShiftbookService;
  knowledge: KnowledgeService;
  audit: AuditService;
  session: SessionService;
  adapter: ManufacturingSystemAdapter;
}
