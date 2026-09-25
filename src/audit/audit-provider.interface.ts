export const AUDIT_PROVIDER = Symbol('AUDIT_PROVIDER');

export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export interface CreateAuditEventInput {
  action: string;
  entityType: string;
  entityId: string | number;
  actorId?: number;
  actorEmail?: string;
  actorRole?: string;
  severity?: AuditSeverity;
  ipAddress?: string;
  userAgent?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId?: number;
  actorEmail?: string;
  actorRole?: string;
  severity: AuditSeverity;
  ipAddress?: string;
  userAgent?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface AuditQueryFilters {
  entityType?: string;
  entityId?: string | number;
  action?: string;
  actorId?: number;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditProvider {
  /** Record a new immutable audit entry */
  record(input: CreateAuditEventInput): Promise<AuditEvent>;

  /** Query audit events with pagination and filters */
  query(filters: AuditQueryFilters): Promise<AuditQueryResult>;

  /** Retrieve the complete chronological history of an entity */
  getEntityHistory(entityType: string, entityId: string | number): Promise<AuditEvent[]>;
}
