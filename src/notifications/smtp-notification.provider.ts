import { randomUUID } from 'node:crypto';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import type { SmtpNotificationConfig } from '../config/notification.validation';
import {
  NotificationDeliveryError,
  NotificationProvider,
  NotificationResult,
  SendNotificationInput,
} from './notification-provider.interface';
import {
  NotificationPermanentError,
  NotificationTimeoutError,
  NotificationTransientError,
} from './notification-errors';

const PERMANENT_SMTP_CODES = new Set([500, 501, 503, 550, 551, 552, 553, 554]);
const SEND_TIMEOUT_MS = 10_000;

@Injectable()
export class SmtpNotificationProvider
  implements NotificationProvider, OnModuleDestroy
{
  private readonly logger = new Logger(SmtpNotificationProvider.name);
  private readonly transporter: Transporter;
  private readonly mailFrom: string;

  constructor(config: SmtpNotificationConfig) {
    this.mailFrom = config.mailFrom;
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPass },
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
  }

  async send(input: SendNotificationInput): Promise<NotificationResult> {
    const messageId = randomUUID();
    const attachments = input.attachments?.map((att) => ({
      filename: att.filename,
      contentType: att.mimeType,
      content: att.content,
    }));

    try {
      await Promise.race([
        this.transporter.sendMail({
          messageId: '<' + messageId + '@tisnet>',
          from: this.mailFrom,
          to: input.recipient,
          subject: input.subject,
          text: input.text,
          html: input.html,
          attachments,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new NotificationTimeoutError()), SEND_TIMEOUT_MS),
        ),
      ]);

      this.logger.log('[SMTP] Delivered messageId=' + messageId + ' to=' + input.recipient);

      return { messageId, recipient: input.recipient, sentAt: new Date() };
    } catch (error) {
      if (error instanceof NotificationDeliveryError) throw error;

      const responseCode: number | undefined =
        (error as { responseCode?: number }).responseCode;

      if (typeof responseCode === 'number') {
        if (PERMANENT_SMTP_CODES.has(responseCode)) throw new NotificationPermanentError();
        throw new NotificationTransientError();
      }

      const message: string = (error as Error).message ?? '';
      if (/timeout|ETIMEDOUT/i.test(message)) throw new NotificationTimeoutError();
      if (/ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(message)) throw new NotificationTransientError();

      throw new NotificationTransientError();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.transporter.close();
  }
}