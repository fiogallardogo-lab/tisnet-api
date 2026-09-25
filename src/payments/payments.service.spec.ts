import { describe, it, expect, vi } from 'vitest';
import { allocateInstallments, PaymentsService } from './payments.service';
const installment = (percentageBasisPoints: number) => ({
  percentageBasisPoints,
  dueDate: '2026-12-01',
  milestone: 'Entrega acordada',
});
describe('Official payment schedule', () => {
  it.each([
    [10000],
    [5000, 5000],
    [3333, 3333, 3334],
    [2000, 2000, 2000, 2000, 2000],
  ])('allocates integer minor units exactly for %j', (...bps) => {
    const parts = allocateInstallments(101, bps.map(installment));
    expect(parts.reduce((s, p) => s + p.amountMinor, 0)).toBe(101);
    expect(parts.every((p) => Number.isInteger(p.amountMinor))).toBe(true);
  });
  it.each([
    [],
    [9900],
    [5000, 5100],
    [0, 10000],
    [10001, -1],
    [1666, 1666, 1666, 1666, 1666, 1670],
  ])('rejects invalid schedule %j', (...bps) => {
    expect(() => allocateInstallments(10000, bps.map(installment))).toThrow();
  });
  it('rejects fractional basis points and zero-amount installments', () => {
    expect(() =>
      allocateInstallments(100, [installment(4999.5), installment(5000.5)]),
    ).toThrow();
    expect(() =>
      allocateInstallments(1, [installment(1), installment(9999)]),
    ).toThrow();
  });
  it('blocks kickoff until the initial payment is confirmed', async () => {
    const db = {
      quote: { findUnique: vi.fn().mockResolvedValue({ activeVersion: 1 }) },
      paymentSchedule: {
        findFirst: vi.fn().mockResolvedValue({ payments: [] }),
      },
    };
    const service = new PaymentsService(db as never);
    await expect(service.assertInitialPayment(1)).rejects.toThrow(
      'pago inicial',
    );
    db.paymentSchedule.findFirst.mockResolvedValue({
      payments: [{ id: 1 }],
      quoteVersion: { id: 3 },
    } as never);
    await expect(service.assertInitialPayment(1)).resolves.toEqual({ id: 3 });
  });
});
