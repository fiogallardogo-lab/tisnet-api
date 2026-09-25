import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { InterviewDecisionDto } from './interview-decision.dto.js';

describe('InterviewDecisionDto', () => {
  it('accepts an approval without a reason', async () => {
    const dto = plainToInstance(InterviewDecisionDto, {
      decision: 'ACCEPTED',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('requires a meaningful reason for a rejection', async () => {
    const missingReason = plainToInstance(InterviewDecisionDto, {
      decision: 'REJECTED',
    });
    const shortReason = plainToInstance(InterviewDecisionDto, {
      decision: 'REJECTED',
      reason: 'No cumple.',
    });

    expect(await validate(missingReason)).not.toHaveLength(0);
    expect(await validate(shortReason)).not.toHaveLength(0);
  });

  it('trims and accepts a valid rejection reason', async () => {
    const dto = plainToInstance(InterviewDecisionDto, {
      decision: 'REJECTED',
      reason: '  El perfil no alcanza la experiencia mínima requerida.  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.reason).toBe(
      'El perfil no alcanza la experiencia mínima requerida.',
    );
  });
});
