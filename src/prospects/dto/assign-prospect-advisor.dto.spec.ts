import { describe, expect, it } from 'vitest';
import { validateSync } from 'class-validator';
import { AssignProspectAdvisorDto } from './assign-prospect-advisor.dto.js';

describe('AssignProspectAdvisorDto', () => {
  it.each([4, null])('accepts advisorProfileId=%s', (advisorProfileId) => {
    const dto = Object.assign(new AssignProspectAdvisorDto(), {
      advisorProfileId,
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it.each([0, -1, 1.5, '4', undefined])(
    'rejects advisorProfileId=%s',
    (advisorProfileId) => {
      const dto = Object.assign(new AssignProspectAdvisorDto(), {
        advisorProfileId,
      });

      expect(validateSync(dto).length).toBeGreaterThan(0);
    },
  );
});
