import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ActivationService } from './activation.service';

const secret = 'isolated-unit-test-secret-not-for-production';
const jwt = new JwtService();
const options = {
  secret,
  audience: 'tisnet-activation',
  issuer: 'tisnet-api',
  algorithm: 'HS256' as const,
};
const token = (payload = {}, expiresIn = 60) =>
  jwt.sign(
    { sub: 9, tokenVersion: 2, purpose: 'activate', ...payload },
    { ...options, expiresIn },
  );
const body = () => ({
  token: token(),
  password: 'Secure-unit-123',
  acceptedTerms: true as const,
  termsVersion: 't1',
  privacyVersion: 'p1',
});
describe('ActivationService single-use token boundary', () => {
  let db: any, mail: any, service: ActivationService;
  beforeEach(() => {
    db = {
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
    };
    db.$transaction = vi.fn(async (fn) => fn(db));
    mail = {
      links: () => ({ activate: 'https://tisnet.test/activate' }),
      send: vi.fn().mockResolvedValue({ delivery: 'SENT' }),
    };
    service = new ActivationService(
      db,
      jwt,
      new ConfigService({
        JWT_SECRET: secret,
        TERMS_VERSION: 't1',
        PRIVACY_VERSION: 'p1',
      }),
      mail,
    );
  });
  it('persists hashed password, current consent and revokes token atomically', async () => {
    expect(await service.activate(body())).toEqual({ activated: true });
    const call = db.user.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      id: 9,
      tokenVersion: 2,
      isActive: false,
      acceptedTermsAt: null,
      role: { name: 'CLIENT' },
    });
    expect(call.data).toMatchObject({
      isActive: true,
      termsVersion: 't1',
      privacyVersion: 'p1',
      tokenVersion: { increment: 1 },
    });
    expect(await bcrypt.compare(body().password, call.data.passwordHash)).toBe(
      true,
    );
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actorId: 9,
        action: 'ACCOUNT_ACTIVATED',
        entityType: 'USER',
        entityId: '9',
        metadata: {},
      },
    });
  });
  it.each([
    ['expired', () => token({}, -1)],
    ['wrong purpose', () => token({ purpose: 'reset-password' })],
    ['invalid user', () => token({ sub: '9' })],
    [
      'invalid signature',
      () => jwt.sign({ sub: 9 }, { secret: 'different-secret' }),
    ],
  ])('rejects %s without database writes', async (_, makeToken) => {
    await expect(
      service.activate({ ...body(), token: makeToken() }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects reused, disabled or already-consented account', async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.activate(body())).rejects.toMatchObject({
      status: 409,
    });
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
  it('rejects missing consent, obsolete terms and bcrypt truncation', async () => {
    for (const patch of [
      { acceptedTerms: false },
      { termsVersion: 'old' },
      { password: '🦄'.repeat(25) },
    ]) {
      await expect(
        service.activate({ ...body(), ...patch } as any),
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('does not disclose account existence or notification failure in the response', async () => {
    db.user.findFirst.mockResolvedValue(null);
    const absent = await service.request('absent@example.test');
    db.user.findFirst.mockResolvedValue({
      id: 9,
      email: 'pending@example.test',
      tokenVersion: 2,
    });
    mail.send.mockRejectedValue(new Error('delivery unavailable'));
    expect(await service.request('pending@example.test')).toEqual(absent);
    expect(db.user.findFirst.mock.calls[1][0].where).toMatchObject({
      isActive: false,
      acceptedTermsAt: null,
      role: { name: 'CLIENT' },
    });
  });
});
