import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlaAlertsService } from './sla-alerts.service';

/**
 * Scheduled jobs that periodically evaluate SLA compliance.
 * All methods are idempotent: safe to re-run without duplicate side-effects.
 */
@Injectable()
export class SlaJobsService {
  private readonly logger = new Logger(SlaJobsService.name);

  constructor(private readonly slaAlerts: SlaAlertsService) {}

  /**
   * Check pending public quotes every hour (skips weekends).
   * SLA threshold: 2 business days.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runQuotesSlaCheck(): Promise<void> {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return;

    this.logger.log('[SLA-JOB] Starting quotes SLA check...');
    try {
      const summary = await this.slaAlerts.checkQuotesSla(2, now);
      this.logger.log(
        `[SLA-JOB] Quotes: checked=${summary.checkedCount} expired=${summary.expiredCount} warning=${summary.warningCount}`,
      );
    } catch {
      this.logger.error(`[SLA-JOB] Quotes SLA check failed`);
    }
  }

  /**
   * Check pending team applications every hour (skips weekends).
   * SLA threshold: 5 business days (PENDING_REVIEW status).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runApplicationsSlaCheck(): Promise<void> {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return;

    this.logger.log('[SLA-JOB] Starting applications SLA check...');
    try {
      const summary = await this.slaAlerts.checkApplicationsSla(5, now);
      this.logger.log(
        `[SLA-JOB] Applications: checked=${summary.checkedCount} expired=${summary.expiredCount} warning=${summary.warningCount}`,
      );
    } catch {
      this.logger.error(`[SLA-JOB] Applications SLA check failed`);
    }
  }
}
