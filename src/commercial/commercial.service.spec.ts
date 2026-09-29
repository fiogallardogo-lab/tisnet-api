import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommercialService } from './commercial.service';
describe('CommercialService transactional boundaries', () => {
  let db: any, service: CommercialService;
  beforeEach(() => {
    db = {
      $queryRaw: vi.fn(),
      quote: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            id: 1,
            activeVersion: 0,
            prospect: { userId: 7 },
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 1 }),
      },
      quoteVersion: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 20, version: 0, acceptedAt: null }),
      },
      quoteObservation: {
        create: vi.fn().mockResolvedValue({ id: 3 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditEvent: { create: vi.fn() },
      contactInquiry: {
        create: vi.fn(async ({ data }) => ({
          ...data,
          createdAt: new Date(0),
        })),
      },
    };
    db.$transaction = vi.fn(async (fn) => fn(db));
    service = new CommercialService(db);
  });
  it('changes only allowed draft fields using expected revision and audit', async () => {
    await service.edit(1, 2, {
      expectedUpdatedAt: '2026-09-28T00:00:00Z',
      fullName: 'Nombre corregido',
    });
    expect(db.quote.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 1, updatedAt: new Date('2026-09-28T00:00:00Z') },
      data: { contactName: 'Nombre corregido' },
    });
    expect(db.auditEvent.create.mock.calls[0][0].data.action).toBe(
      'QUOTE_EDITED',
    );
  });
  it.each([
    [null, 404],
    [{ activeVersion: 1 }, 409],
  ])('rejects missing or official quote', async (quote, status) => {
    db.quote.findUnique.mockResolvedValue(quote);
    await expect(
      service.edit(1, 2, {
        expectedUpdatedAt: new Date().toISOString(),
        notes: 'Cambio',
      }),
    ).rejects.toMatchObject({ status });
    expect(db.quote.updateMany).not.toHaveBeenCalled();
  });
  it('rejects stale updates and does not audit success', async () => {
    db.quote.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.edit(1, 2, {
        expectedUpdatedAt: new Date().toISOString(),
        notes: 'Cambio',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
  it('writes observation and audit together, without exposing text in metadata', async () => {
    await service.observe(1, 7, { versionId: 20, text: 'Cambiar alcance' });
    expect(db.quoteObservation.create).toHaveBeenCalledWith({
      data: { quoteId: 1, versionId: 20, authorId: 7, text: 'Cambiar alcance' },
    });
    expect(db.auditEvent.create.mock.calls[0][0].data.metadata).toEqual({
      version: 0,
    });
  });
  it('rejects another client and accepted or superseded versions', async () => {
    await expect(
      service.observe(1, 8, { versionId: 20, text: 'Cambio' }),
    ).rejects.toMatchObject({ status: 403 });
    db.quoteVersion.findFirst.mockResolvedValue({
      id: 20,
      version: 0,
      acceptedAt: new Date(),
    });
    await expect(
      service.observe(1, 7, { versionId: 20, text: 'Cambio' }),
    ).rejects.toMatchObject({ status: 409 });
    db.quoteVersion.findFirst.mockResolvedValue({
      id: 20,
      version: 1,
      acceptedAt: null,
    });
    await expect(
      service.observe(1, 7, { versionId: 20, text: 'Cambio' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.quoteObservation.create).not.toHaveBeenCalled();
  });
  it('confirms only contact data that was persisted', async () => {
    const result = await service.contact({
      name: 'Cliente',
      email: 'client@example.test',
      subject: 'Consulta',
      message: 'Solicito información',
    });
    expect(result).toMatchObject({
      status: 'RECEIVED',
      createdAt: new Date(0),
    });
    expect(result.code).toMatch(/^C-[0-9a-f-]{36}$/);
    db.contactInquiry.create.mockRejectedValue(new Error('DB unavailable'));
    await expect(
      service.contact({
        name: 'Cliente',
        email: 'client@example.test',
        subject: 'Consulta',
        message: 'Solicito información',
      }),
    ).rejects.toThrow('DB unavailable');
  });
});
