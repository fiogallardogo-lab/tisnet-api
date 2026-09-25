import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as nodemailer from 'nodemailer';

import { SmtpNotificationProvider } from './smtp-notification.provider';
import {
  NotificationPermanentError,
  NotificationTimeoutError,
  NotificationTransientError,
} from './notification-errors';

vi.mock('nodemailer');

const mockSendMail = vi.fn();
const mockClose = vi.fn();

vi.mocked(nodemailer.createTransport).mockReturnValue({
  sendMail: mockSendMail,
  close: mockClose,
} as unknown as nodemailer.Transporter);

const baseConfig = {
  provider: 'smtp' as const,
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: 'user@example.com',
  smtpPass: 'secret',
  smtpSecure: true,
  mailFrom: '"TISNET" <no-reply@tisnet.pe>',
};

describe('SmtpNotificationProvider', () => {
  let provider: SmtpNotificationProvider;

  beforeEach(() => {
    provider = new SmtpNotificationProvider(baseConfig);
    vi.clearAllMocks();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('sends a message and returns result with messageId and sentAt', async () => {
    mockSendMail.mockResolvedValue({});
    const result = await provider.send({
      recipient: 'candidate@example.com',
      subject: 'Entrevista asignada',
      text: 'Tu entrevista esta programada.',
    });
    expect(result.recipient).toBe('candidate@example.com');
    expect(result.messageId).toBeTruthy();
    expect(result.sentAt).toBeInstanceOf(Date);
    expect(mockSendMail).toHaveBeenCalledOnce();
  });

  it('includes attachments when provided', async () => {
    mockSendMail.mockResolvedValue({});
    await provider.send({
      recipient: 'a@b.com',
      subject: 'Cotizacion',
      text: 'Adjuntamos la cotizacion.',
      attachments: [{ filename: 'quote.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF') }],
    });
    const callArgs = mockSendMail.mock.calls[0][0] as { attachments: unknown[] };
    expect(callArgs.attachments).toHaveLength(1);
  });

  it('throws NotificationPermanentError on SMTP 550', async () => {
    const error = Object.assign(new Error('User unknown'), { responseCode: 550 });
    mockSendMail.mockRejectedValue(error);
    await expect(
      provider.send({ recipient: 'x@y.com', subject: 'Test', text: 'Test' }),
    ).rejects.toBeInstanceOf(NotificationPermanentError);
  });

  it('throws NotificationTransientError on SMTP 421', async () => {
    const error = Object.assign(new Error('Service unavailable'), { responseCode: 421 });
    mockSendMail.mockRejectedValue(error);
    await expect(
      provider.send({ recipient: 'x@y.com', subject: 'Test', text: 'Test' }),
    ).rejects.toBeInstanceOf(NotificationTransientError);
  });

  it('throws NotificationTransientError on ECONNREFUSED', async () => {
    mockSendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      provider.send({ recipient: 'x@y.com', subject: 'Test', text: 'Test' }),
    ).rejects.toBeInstanceOf(NotificationTransientError);
  });

  it('throws NotificationTimeoutError on ETIMEDOUT message', async () => {
    mockSendMail.mockRejectedValue(new Error('ETIMEDOUT'));
    await expect(
      provider.send({ recipient: 'x@y.com', subject: 'Test', text: 'Test' }),
    ).rejects.toBeInstanceOf(NotificationTimeoutError);
  });

  it('closes the transporter on module destroy', async () => {
    await provider.onModuleDestroy();
    expect(mockClose).toHaveBeenCalledOnce();
  });
});