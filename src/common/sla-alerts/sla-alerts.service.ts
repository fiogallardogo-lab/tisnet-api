import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { BusinessDaysService } from '../business-days/business-days.service';
import { AuditService } from '../../audit/audit.service';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../../notifications/notification-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';

export interface SlaAlertItem {
  entityId: number | string;
  entityType: 'Quote' | 'TeamApplication';
  code: string;
  createdAt: Date;
  deadline: Date;
  remainingBusinessDays: number;
  isExpired: boolean;
  status: string;
}

export interface SlaCheckSummary {
  checkedCount: number;
  expiredCount: number;
  warningCount: number;
  alerts: SlaAlertItem[];
}

@Injectable()
export class SlaAlertsService {
  private readonly logger = new Logger(SlaAlertsService.name);

  constructor(
    private readonly businessDaysService: BusinessDaysService,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider?: NotificationProvider,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  /**
   * Evaluates pending public quotes against an SLA deadline (e.g. 2 business days).
   */
  async checkQuotesSla(
    slaBusinessDays = 2,
    referenceDate = new Date(),
  ): Promise<SlaCheckSummary> {
    this.logger.log(`Checking Quotes SLA (limit=${slaBusinessDays} business days)...`);

    const pendingQuotes = await this.prisma.publicQuote.findMany({
      where: {
        pricingStatus: { in: ['CALCULATED', 'PENDING_RULES', 'PENDING'] },
      },
      take: 100,
    });

    const alerts: SlaAlertItem[] = [];
    let expiredCount = 0;
    let warningCount = 0;

    for (const quote of pendingQuotes) {
      const sla = this.businessDaysService.calculateSlaDeadline(
        quote.createdAt,
        slaBusinessDays,
        referenceDate,
      );

      const isWarning = !sla.isExpired && sla.remainingBusinessDays <= 1;

      if (sla.isExpired || isWarning) {
        if (sla.isExpired) expiredCount++;
        if (isWarning) warningCount++;

        const alertItem: SlaAlertItem = {
          entityId: quote.id,
          entityType: 'Quote',
          code: quote.code,
          createdAt: quote.createdAt,
          deadline: sla.deadline,
          remainingBusinessDays: sla.remainingBusinessDays,
          isExpired: sla.isExpired,
          status: quote.pricingStatus,
        };

        alerts.push(alertItem);

        // Audit log
        void this.auditService?.record({
          action: sla.isExpired ? 'SLA_BREACH_QUOTE' : 'SLA_WARNING_QUOTE',
          entityType: 'Quote',
          entityId: quote.id,
          severity: sla.isExpired ? 'ERROR' : 'WARN',
          metadata: {
            code: quote.code,
            remainingBusinessDays: sla.remainingBusinessDays,
            deadline: sla.deadline.toISOString(),
          },
        });
      }
    }

    return {
      checkedCount: pendingQuotes.length,
      expiredCount,
      warningCount,
      alerts,
    };
  }

  /**
   * Evaluates candidate team applications awaiting interview assignment against an SLA deadline (e.g. 3 business days).
   */
  async checkApplicationsSla(
    slaBusinessDays = 3,
    referenceDate = new Date(),
  ): Promise<SlaCheckSummary> {
    this.logger.log(`Checking Team Applications SLA (limit=${slaBusinessDays} business days)...`);

    const pendingApps = await this.prisma.teamApplication.findMany({
      where: {
        status: 'PENDING_REVIEW',
      },
      take: 100,
    });

    const alerts: SlaAlertItem[] = [];
    let expiredCount = 0;
    let warningCount = 0;

    for (const app of pendingApps) {
      const sla = this.businessDaysService.calculateSlaDeadline(
        app.createdAt,
        slaBusinessDays,
        referenceDate,
      );

      const isWarning = !sla.isExpired && sla.remainingBusinessDays <= 1;

      if (sla.isExpired || isWarning) {
        if (sla.isExpired) expiredCount++;
        if (isWarning) warningCount++;

        const alertItem: SlaAlertItem = {
          entityId: app.id,
          entityType: 'TeamApplication',
          code: app.code,
          createdAt: app.createdAt,
          deadline: sla.deadline,
          remainingBusinessDays: sla.remainingBusinessDays,
          isExpired: sla.isExpired,
          status: app.status,
        };

        alerts.push(alertItem);

        void this.auditService?.record({
          action: sla.isExpired ? 'SLA_BREACH_APPLICATION' : 'SLA_WARNING_APPLICATION',
          entityType: 'TeamApplication',
          entityId: app.id,
          severity: sla.isExpired ? 'ERROR' : 'WARN',
          metadata: {
            code: app.code,
            remainingBusinessDays: sla.remainingBusinessDays,
            deadline: sla.deadline.toISOString(),
          },
        });
      }
    }

    return {
      checkedCount: pendingApps.length,
      expiredCount,
      warningCount,
      alerts,
    };
  }
}
