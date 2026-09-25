import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SlaAlertsService } from './sla-alerts.service';
import { BusinessDaysService } from '../business-days/business-days.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SlaAlertsService', () => {
  let service: SlaAlertsService;
  let businessDaysService: BusinessDaysService;

  const prismaMock = {
    publicQuote: {
      findMany: vi.fn(),
    },
    teamApplication: {
      findMany: vi.fn(),
    },
  };

  const auditServiceMock = {
    record: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    businessDaysService = new BusinessDaysService();
    service = new SlaAlertsService(
      businessDaysService,
      prismaMock as unknown as PrismaService,
      undefined,
      auditServiceMock as any,
    );
  });

  it('detects quotes that have breached SLA or are approaching deadline', async () => {
    // Reference date: Wednesday 23 Sept 2026 10:00
    const now = new Date(2026, 8, 23, 10, 0, 0);

    // Quote 1: created 2 weeks ago -> expired
    const oldQuote = {
      id: 1,
      code: 'QT-OLD',
      createdAt: new Date(2026, 8, 1, 10, 0, 0),
      status: 'RECEIVED',
    };

    // Quote 2: created yesterday -> warning (1 business day remaining on 2-day SLA)
    const warningQuote = {
      id: 2,
      code: 'QT-WARN',
      createdAt: new Date(2026, 8, 22, 10, 0, 0),
      status: 'RECEIVED',
    };

    // Quote 3: created 10 minutes ago -> safe
    const safeQuote = {
      id: 3,
      code: 'QT-SAFE',
      createdAt: new Date(2026, 8, 23, 9, 50, 0),
      status: 'RECEIVED',
    };

    prismaMock.publicQuote.findMany.mockResolvedValue([
      oldQuote,
      warningQuote,
      safeQuote,
    ]);

    const result = await service.checkQuotesSla(2, now);

    expect(result.checkedCount).toBe(3);
    expect(result.expiredCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(result.alerts).toHaveLength(2);

    expect(result.alerts[0].code).toBe('QT-OLD');
    expect(result.alerts[0].isExpired).toBe(true);

    expect(result.alerts[1].code).toBe('QT-WARN');
    expect(result.alerts[1].isExpired).toBe(false);

    // Verify audit events were recorded
    expect(auditServiceMock.record).toHaveBeenCalledTimes(2);
  });

  it('detects applications that have breached 3-day SLA', async () => {
    const now = new Date(2026, 8, 25, 10, 0, 0);

    const expiredApp = {
      id: 10,
      code: 'TEAM-EXP',
      createdAt: new Date(2026, 8, 15, 10, 0, 0),
      status: 'PENDING',
    };

    prismaMock.teamApplication.findMany.mockResolvedValue([expiredApp]);

    const result = await service.checkApplicationsSla(3, now);

    expect(result.checkedCount).toBe(1);
    expect(result.expiredCount).toBe(1);
    expect(result.alerts[0].code).toBe('TEAM-EXP');
    expect(auditServiceMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SLA_BREACH_APPLICATION',
      }),
    );
  });
});
