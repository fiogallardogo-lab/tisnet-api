import { Injectable, Logger } from '@nestjs/common';
import {
  AuditEvent,
  AuditProvider,
  AuditQueryFilters,
  AuditQueryResult,
  CreateAuditEventInput,
} from './audit-provider.interface';

@Injectable()
export class InMemoryAuditProvider implements AuditProvider {
  private readonly logger = new Logger(InMemoryAuditProvider.name);
  private readonly events: AuditEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents = 10000) {
    this.maxEvents = maxEvents;
  }

  async record(input: CreateAuditEventInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      action: input.action,
      entityType: input.entityType,
      entityId: String(input.entityId),
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      severity: input.severity ?? 'INFO',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      previousState: input.previousState ? { ...input.previousState } : undefined,
      newState: input.newState ? { ...input.newState } : undefined,
      metadata: input.metadata ? { ...input.metadata } : undefined,
      timestamp: new Date(),
    };

    this.events.unshift(event); // newest first

    // Prevent unbounded memory growth
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    this.logger.debug(
      `[Audit] Action=${event.action} Entity=${event.entityType}:${event.entityId} Actor=${event.actorEmail ?? 'SYSTEM'} Severity=${event.severity}`,
    );

    return event;
  }

  async query(filters: AuditQueryFilters): Promise<AuditQueryResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, Math.min(100, filters.limit ?? 20));

    let filtered = this.events;

    if (filters.entityType) {
      filtered = filtered.filter(
        (e) => e.entityType.toLowerCase() === filters.entityType!.toLowerCase(),
      );
    }

    if (filters.entityId != null) {
      const targetId = String(filters.entityId);
      filtered = filtered.filter((e) => e.entityId === targetId);
    }

    if (filters.action) {
      filtered = filtered.filter(
        (e) => e.action.toLowerCase() === filters.action!.toLowerCase(),
      );
    }

    if (filters.actorId != null) {
      filtered = filtered.filter((e) => e.actorId === filters.actorId);
    }

    if (filters.severity) {
      filtered = filtered.filter((e) => e.severity === filters.severity);
    }

    if (filters.startDate) {
      filtered = filtered.filter((e) => e.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter((e) => e.timestamp <= filters.endDate!);
    }

    const total = filtered.length;
    const startIdx = (page - 1) * limit;
    const paginatedEvents = filtered.slice(startIdx, startIdx + limit);

    return {
      events: paginatedEvents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEntityHistory(
    entityType: string,
    entityId: string | number,
  ): Promise<AuditEvent[]> {
    const targetId = String(entityId);
    return this.events.filter(
      (e) =>
        e.entityType.toLowerCase() === entityType.toLowerCase() &&
        e.entityId === targetId,
    );
  }

  /** Test helper to clear memory */
  clear(): void {
    this.events.length = 0;
  }
}
