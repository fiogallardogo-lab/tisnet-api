import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAuditProvider } from './in-memory-audit.provider';

describe('InMemoryAuditProvider', () => {
  let provider: InMemoryAuditProvider;

  beforeEach(() => {
    provider = new InMemoryAuditProvider(100);
  });

  it('records an audit event with generated id and timestamp', async () => {
    const event = await provider.record({
      action: 'QUOTE_STATUS_CHANGED',
      entityType: 'Quote',
      entityId: 101,
      actorEmail: 'admin@tisnet.pe',
      actorRole: 'ADMIN',
      severity: 'INFO',
      previousState: { status: 'DRAFT' },
      newState: { status: 'SENT' },
    });

    expect(event.id).toBeDefined();
    expect(event.action).toBe('QUOTE_STATUS_CHANGED');
    expect(event.entityType).toBe('Quote');
    expect(event.entityId).toBe('101');
    expect(event.actorEmail).toBe('admin@tisnet.pe');
    expect(event.previousState).toEqual({ status: 'DRAFT' });
    expect(event.newState).toEqual({ status: 'SENT' });
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it('filters queries by entityType and entityId', async () => {
    await provider.record({ action: 'A1', entityType: 'Quote', entityId: 1 });
    await provider.record({ action: 'A2', entityType: 'Quote', entityId: 2 });
    await provider.record({ action: 'A3', entityType: 'User', entityId: 1 });

    const quote1History = await provider.getEntityHistory('Quote', 1);
    expect(quote1History).toHaveLength(1);
    expect(quote1History[0].action).toBe('A1');

    const quoteQuery = await provider.query({ entityType: 'Quote' });
    expect(quoteQuery.total).toBe(2);
  });

  it('paginates results correctly', async () => {
    for (let i = 1; i <= 25; i++) {
      await provider.record({
        action: `ACTION_${i}`,
        entityType: 'Test',
        entityId: i,
      });
    }

    const page1 = await provider.query({ limit: 10, page: 1 });
    expect(page1.events).toHaveLength(10);
    expect(page1.total).toBe(25);
    expect(page1.totalPages).toBe(3);

    const page3 = await provider.query({ limit: 10, page: 3 });
    expect(page3.events).toHaveLength(5);
  });
});
