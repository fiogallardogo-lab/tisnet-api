import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CommercialMailService } from './commercial-mail.service';

describe('Commercial mail delivery boundaries', () => {
  let db: any, renderer: any, provider: any, service: CommercialMailService;
  beforeEach(() => {
    db = {
      quote: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            id: 3,
            publicCode: 'Q-ABCDEFGH',
            contactName: 'Cliente',
            contactEmail: 'client@example.test',
            solutionType: 'LANDING_PAGE',
            createdAt: new Date(),
            options: [],
            items: [],
            amountMinor: 500,
            currency: 'PEN',
            pricingVersion: null,
            versions: [
              {
                id: 12,
                version: 2,
                createdAt: new Date(),
                amountMinor: 15000,
                currency: 'PEN',
                schedules: [
                  { sequence: 1, milestone: 'Adelanto', amountMinor: 15000 },
                ],
              },
            ],
          }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    renderer = {
      renderQuote: vi
        .fn()
        .mockResolvedValue({
          mimeType: 'application/pdf',
          content: Buffer.from('%PDF-test'),
        }),
    };
    provider = {
      send: vi.fn().mockResolvedValue({ messageId: 'test-message' }),
    };
    service = new CommercialMailService(
      db,
      new ConfigService({ PUBLIC_FRONTEND_URL: 'https://tisnet.test' }),
      renderer,
      provider,
    );
  });
  it('sends the committed version, even if another version is officialized concurrently', async () => {
    await service.quoteAfterCommit(3, 12);
    expect(db.quote.findUnique.mock.calls[0][0].include.versions.where).toEqual(
      { id: 12 },
    );
    expect(renderer.renderQuote.mock.calls[0][0].pricing.totalMinor).toBe(
      15000,
    );
    const message = provider.send.mock.calls[0][0];
    expect(message.recipient).toBe('client@example.test');
    expect(message.attachments[0].filename).toBe('Q-ABCDEFGH-v2.pdf');
    expect(message.text).toContain('https://tisnet.test/register');
  });
  it('records renderer failure without sending or undoing the saved business operation', async () => {
    renderer.renderQuote.mockRejectedValue(new Error('render failed'));
    expect(await service.quoteAfterCommit(3, 12)).toEqual({
      delivery: 'FAILED',
    });
    expect(provider.send).not.toHaveBeenCalled();
    expect(db.auditEvent.create.mock.calls[0][0].data.action).toBe(
      'COMMERCIAL_MAIL_FAILED',
    );
  });
  it('records lookup failure after commit instead of failing officialization', async () => {
    db.quote.findUnique.mockRejectedValue(new Error('connection lost'));
    expect(await service.quoteAfterCommit(3, 12)).toEqual({
      delivery: 'FAILED',
    });
    expect(db.auditEvent.create.mock.calls[0][0].data.action).toBe(
      'COMMERCIAL_MAIL_FAILED',
    );
  });
  it('does not report provider errors as success or persist message contents', async () => {
    provider.send.mockRejectedValue(new Error('smtp rejected'));
    expect(await service.quote(3)).toEqual({ delivery: 'FAILED' });
    expect(db.auditEvent.create.mock.calls[0][0].data).toEqual({
      action: 'COMMERCIAL_MAIL_FAILED',
      entityType: 'QUOTE',
      entityId: '3',
      metadata: {},
    });
  });
  it('does not invent a quote or replace a missing historical version with the current one', async () => {
    db.quote.findUnique.mockResolvedValue(null);
    await expect(service.quote(999)).rejects.toMatchObject({ status: 404 });
    db.quote.findUnique.mockResolvedValue({ versions: [] });
    await expect(service.quote(3, 999)).rejects.toMatchObject({ status: 404 });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('sends client activation email with credentials and login link', async () => {
    const result = await service.sendClientActivationEmail({
      recipientName: 'Carlos Gomez',
      recipientEmail: 'carlos@example.com',
      password: 'TemporaryPass123!',
      company: 'Tech SAC',
      quoteCode: 'TIS-98213',
      userId: 55,
    });

    expect(result).toEqual({ delivery: 'SENT', messageId: 'test-message' });
    expect(provider.send).toHaveBeenCalledTimes(1);
    const sent = provider.send.mock.calls[0][0];
    expect(sent.recipient).toBe('carlos@example.com');
    expect(sent.subject).toContain('¡Tu cuenta ha sido activada!');
    expect(sent.html).toContain('Carlos Gomez');
    expect(sent.html).toContain('TemporaryPass123!');
    expect(sent.html).toContain('https://tisnet.test/login');
    expect(sent.text).toContain('Carlos Gomez');
    expect(sent.text).toContain('TemporaryPass123!');
  });
});
