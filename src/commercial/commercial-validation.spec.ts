import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { allocateInstallments } from '../payments/payments.service';
import { validateNotificationConfig } from '../config/notification.validation';
import {
  AcceptQuoteDto,
  ContactDto,
  ObservationDto,
  EditQuoteDto,
} from './commercial.dto';
const quota = {
  percentageBasisPoints: 10000,
  dueDate: '2026-10-01',
  milestone: 'Adelanto',
};
describe('Commercial input invariants', () => {
  it.each([
    [],
    Array(6).fill(quota),
    [{ ...quota, percentageBasisPoints: 9999 }],
    [{ ...quota, dueDate: '2026-02-30' }],
    [{ ...quota, dueDate: '2026-10-01T10:00:00Z' }],
    [{ ...quota, milestone: '  ' }],
    [
      { ...quota, percentageBasisPoints: 5000 },
      { ...quota, percentageBasisPoints: 5000, dueDate: '2026-09-30' },
    ],
  ])('rejects invalid quota schedule %#', (installments) => {
    expect(() => allocateInstallments(10000, installments)).toThrow();
  });
  it('supports five installments and preserves every cent after rounding', () => {
    const result = allocateInstallments(
      101,
      [3333, 3333, 1111, 1111, 1112].map((percentageBasisPoints) => ({
        ...quota,
        percentageBasisPoints,
      })),
    );
    expect(result).toHaveLength(5);
    expect(result.reduce((sum, x) => sum + x.amountMinor, 0)).toBe(101);
  });
  it('rejects false/string consent, unknown fields and blank observations', async () => {
    for (const accepted of [false, 'true'])
      expect(
        await validate(
          plainToInstance(AcceptQuoteDto, { versionId: 7, accepted }),
        ),
      ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ObservationDto, { versionId: 7, text: '   ' }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(EditQuoteDto, {
          expectedUpdatedAt: new Date().toISOString(),
          status: 'APPROVED',
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).not.toHaveLength(0);
  });
  it('normalizes contact email and trims content', async () => {
    const dto = plainToInstance(ContactDto, {
      name: ' Client ',
      email: ' CLIENT@example.test ',
      subject: ' Consulta ',
      message: ' Mensaje de consulta ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('client@example.test');
    expect(dto.message).toBe('Mensaje de consulta');
  });
  it('blocks fake mail in production and final demo', () => {
    expect(() =>
      validateNotificationConfig({ NODE_ENV: 'production' }),
    ).toThrow(/SMTP/);
    expect(() =>
      validateNotificationConfig({
        S14_DEMO: 'true',
        NOTIFICATION_PROVIDER: 'fake',
      }),
    ).toThrow(/SMTP/);
    expect(validateNotificationConfig({ NODE_ENV: 'test' }).provider).toBe(
      'fake',
    );
  });
});
