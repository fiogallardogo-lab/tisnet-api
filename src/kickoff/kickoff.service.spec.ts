import { describe, it, expect } from 'vitest';
import { validateParticipation } from './kickoff.service';
const po = {
  userId: 1,
  role: 'PRODUCT_OWNER' as const,
  participationBasisPoints: 2000,
};
const dev = {
  userId: 2,
  role: 'DEVELOPER' as const,
  participationBasisPoints: 8000,
};
describe('Project participation', () => {
  it('requires exactly one PO and total 100%', () => {
    expect(() => validateParticipation([po, dev])).not.toThrow();
    expect(() => validateParticipation([dev])).toThrow();
    expect(() =>
      validateParticipation([po, { ...dev, participationBasisPoints: 7999 }]),
    ).toThrow();
  });
  it('rejects duplicate members, fractional and out-of-range percentages', () => {
    expect(() => validateParticipation([po, { ...dev, userId: 1 }])).toThrow();
    expect(() =>
      validateParticipation([
        { ...po, participationBasisPoints: -1 },
        { ...dev, participationBasisPoints: 10001 },
      ]),
    ).toThrow();
    expect(() =>
      validateParticipation([
        { ...po, participationBasisPoints: 1999.5 },
        { ...dev, participationBasisPoints: 8000.5 },
      ]),
    ).toThrow();
  });
});
