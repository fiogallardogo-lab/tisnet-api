import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  SendWhatsAppInput,
  WhatsAppNotificationProvider,
  WhatsAppNotificationResult,
} from './whatsapp-notification-provider.interface';

@Injectable()
export class FakeWhatsAppNotificationProvider
  implements WhatsAppNotificationProvider
{
  private readonly logger = new Logger(FakeWhatsAppNotificationProvider.name);
  readonly deliveryMode = 'simulated';
  readonly sentMessages: Array<SendWhatsAppInput & { sentAt: Date; messageId: string }> = [];

  async send(input: SendWhatsAppInput): Promise<WhatsAppNotificationResult> {
    const messageId = `sim_wa_${randomUUID()}`;
    const sentAt = new Date();

    this.logger.log(
      `[SIMULATED WHATSAPP] To: ${input.recipientPhone} | Message:\n${input.message}`,
    );

    this.sentMessages.push({
      ...input,
      sentAt,
      messageId,
    });

    return {
      messageId,
      recipientPhone: input.recipientPhone,
      sentAt,
      status: 'SIMULATED',
    };
  }

  clear(): void {
    this.sentMessages.length = 0;
  }
}
