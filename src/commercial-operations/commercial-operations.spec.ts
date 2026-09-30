import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { threeLimaBusinessDays, reminderPolicy } from './lima-calendar';
import { economicState, FinancialService } from './financial.service';
import { approvedLegalContent } from './legal-content';
import { PublicTeamService } from './public-team.service';
import { validateLegalVersions } from '../common/legal/legal-versions';
const config = (values: Record<string, unknown>) => new ConfigService(values);
describe('Sprint15 calendar', () => {
  it.each([
    ['2026-09-28T12:00:00Z', '2026-10-01T23:00:00.000Z'],
    ['2026-09-29T02:00:00Z', '2026-10-01T23:00:00.000Z'],
    ['2026-04-01T17:00:00Z', '2026-04-08T23:00:00.000Z'],
    ['2026-07-27T17:00:00Z', '2026-08-03T23:00:00.000Z'],
    ['2026-12-30T17:00:00Z', '2027-01-05T23:00:00.000Z'],
  ])('Lima date, weekends and national holidays %s', (input, expected) =>
    expect(threeLimaBusinessDays(new Date(input), '18:00').toISOString()).toBe(
      expected,
    ),
  );
  it('supports approved additional non-working dates', () =>
    expect(
      threeLimaBusinessDays(new Date('2026-09-28T12:00Z'), '09:30', [
        '2026-09-29',
      ]).toISOString(),
    ).toBe('2026-10-02T14:30:00.000Z'));
  it.each([
    {},
    { PAYMENT_REMINDER_CUTOFF: '25:00', PAYMENT_REMINDER_POLICY_VERSION: 'x' },
    {
      PAYMENT_REMINDER_CUTOFF: '18:00',
      PAYMENT_REMINDER_POLICY_VERSION: 'x',
      PAYMENT_REMINDER_EXTRA_HOLIDAYS: '2026-02-30',
    },
  ])('fails closed without a valid approved policy', (value) =>
    expect(() => reminderPolicy(config(value))).toThrow(),
  );
});
const version = () => ({
  id: 1,
  version: 1,
  currency: 'PEN',
  amountMinor: 100,
  acceptedAt: new Date(),
  schedules: [
    {
      id: 1,
      sequence: 1,
      amountMinor: 100,
      payments: [{ amountMinor: 100, currency: 'PEN', status: 'CONFIRMED' }],
    },
  ],
});
describe('Sprint15 economic close', () => {
  it('requires exact confirmed totals', () =>
    expect(economicState(version()).complete).toBe(true));
  it.each(['FAILED', 'PENDING'])('does not count %s payments', (status) => {
    const v = version();
    v.schedules[0].payments[0].status = status;
    expect(economicState(v).complete).toBe(false);
  });
  it.each([99, 101])(
    'rejects insufficient or excessive payment %s',
    (amount) => {
      const v = version();
      v.schedules[0].payments[0].amountMinor = amount;
      expect(economicState(v).complete).toBe(false);
    },
  );
  it('rejects wrong currency', () => {
    const v = version();
    v.schedules[0].payments[0].currency = 'USD';
    expect(economicState(v).state).toBe('INCONSISTENT');
  });
  it('requires acceptance and official schedules', () => {
    expect(economicState({ ...version(), acceptedAt: null }).complete).toBe(
      false,
    );
    expect(economicState({ ...version(), schedules: [] }).complete).toBe(false);
    expect(economicState(null).complete).toBe(false);
  });
  it('selects only activeVersion and checks ownership before loading amounts', async () => {
    const db: any = {
      quote: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ activeVersion: 2, prospect: { userId: 3 } }),
      },
      quoteVersion: { findUnique: vi.fn().mockResolvedValue(version()) },
    };
    const service = new FinancialService(db);
    await expect(
      service.forQuote(7, { id: 9, role: 'CLIENT' }),
    ).rejects.toThrow();
    expect(db.quoteVersion.findUnique).not.toHaveBeenCalled();
    await service.forQuote(7, { id: 3, role: 'CLIENT' });
    expect(db.quoteVersion.findUnique.mock.calls[0][0].where).toEqual({
      quoteId_version: { quoteId: 7, version: 2 },
    });
  });
});
describe('Sprint15 legal and public privacy', () => {
  it('publishes only approved matching text and gates production consent', () => {
    const dir = mkdtempSync(join(tmpdir(), 's15-legal-'));
    const file = join(dir, 'legal.json');
    try {
      const c = config({
        LEGAL_CONTENT_FILE: file,
        TERMS_VERSION: 'test',
        PRIVACY_VERSION: 'test',
        NODE_ENV: 'production',
      });
      expect(() => approvedLegalContent(c)).toThrow();
      const data = {
        approvalReference: 'TEST FIXTURE ONLY',
        approvedAt: '2026-01-01T00:00:00Z',
        terms: {
          version: 'test',
          text: 'Texto ficticio de prueba: no utilizar en producción.',
        },
        privacy: {
          version: 'test',
          text: 'Privacidad ficticia de prueba: no utilizar en producción.',
        },
        privateNote: 'DO NOT EXPOSE',
      };
      writeFileSync(file, JSON.stringify(data));
      const publicData = approvedLegalContent(c);
      expect(JSON.stringify(publicData)).not.toContain('DO NOT EXPOSE');
      expect(publicData.contentHash).toHaveLength(64);
      expect(
        validateLegalVersions(c, {
          termsVersion: 'test',
          privacyVersion: 'test',
        }),
      ).toEqual({ termsVersion: 'test', privacyVersion: 'test' });
      expect(() =>
        validateLegalVersions(c, {
          termsVersion: 'old',
          privacyVersion: 'test',
        }),
      ).toThrow();
      data.terms.version = 'different';
      writeFileSync(file, JSON.stringify(data));
      expect(() => approvedLegalContent(c)).toThrow();
      expect(() =>
        validateLegalVersions(
          config({
            NODE_ENV: 'production',
            TERMS_VERSION: 'test',
            PRIVACY_VERSION: 'test',
          }),
          { termsVersion: 'test', privacyVersion: 'test' },
        ),
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it.each([
    'https://public.example.test/cv.pdf',
    'https://public.example.test/photo.png?token=secret',
    'https://private.example.test/photo.png',
    'http://public.example.test/photo.png',
    'https://user:password@public.example.test/photo.png',
  ])('rejects private or unapproved photo %s', (url) => {
    const service = new PublicTeamService(
      {} as any,
      config({ PUBLIC_TEAM_MEDIA_HOSTS: 'public.example.test' }),
    );
    expect(() => service.publicPhoto(url)).toThrow();
  });
  it('accepts a curated public image without a token', () =>
    expect(
      new PublicTeamService(
        {} as any,
        config({ PUBLIC_TEAM_MEDIA_HOSTS: 'public.example.test' }),
      ).publicPhoto('https://public.example.test/photo.png'),
    ).toBe('https://public.example.test/photo.png'));
});
