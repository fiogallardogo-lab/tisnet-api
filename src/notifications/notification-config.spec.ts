import { describe, expect, it } from 'vitest';
import { validateNotificationConfig } from '../config/notification.validation';

describe('Notification configuration', () => {
  describe('provider=fake', () => {
    it('defaults to fake when NOTIFICATION_PROVIDER is absent', () => {
      expect(validateNotificationConfig({})).toMatchObject({ provider: 'fake' });
    });

    it('accepts explicit NOTIFICATION_PROVIDER=fake', () => {
      expect(
        validateNotificationConfig({ NOTIFICATION_PROVIDER: 'fake' }),
      ).toMatchObject({ provider: 'fake' });
    });
  });

  describe('provider=smtp', () => {
    const validSmtp = {
      NOTIFICATION_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user@example.com',
      SMTP_PASS: 'secret',
      MAIL_FROM: '"TISNET" <no-reply@tisnet.pe>',
    };

    it('returns smtp config with all required vars', () => {
      const result = validateNotificationConfig(validSmtp);
      expect(result).toMatchObject({
        provider: 'smtp',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'user@example.com',
        smtpSecure: true,
        mailFrom: '"TISNET" <no-reply@tisnet.pe>',
      });
    });

    it('defaults smtpSecure=true when SMTP_SECURE is absent', () => {
      const result = validateNotificationConfig(validSmtp);
      expect((result as { smtpSecure: boolean }).smtpSecure).toBe(true);
    });

    it('accepts SMTP_SECURE=false', () => {
      const result = validateNotificationConfig({ ...validSmtp, SMTP_SECURE: 'false' });
      expect((result as { smtpSecure: boolean }).smtpSecure).toBe(false);
    });

    it.each(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'])(
      'throws when %s is missing',
      (missingKey) => {
        const env = { ...validSmtp, [missingKey]: undefined };
        expect(() => validateNotificationConfig(env)).toThrow(
          'missing required env var "' + missingKey + '"',
        );
      },
    );

    it('throws on invalid SMTP_PORT', () => {
      expect(() =>
        validateNotificationConfig({ ...validSmtp, SMTP_PORT: 'not-a-port' }),
      ).toThrow('SMTP_PORT must be a valid port number');
    });
  });

  describe('provider=resend', () => {
    const validResend = {
      NOTIFICATION_PROVIDER: 'resend',
      RESEND_API_KEY: 're_abc123',
      MAIL_FROM: 'TISNET <no-reply@tisnet.pe>',
    };

    it('returns resend config with all required vars', () => {
      expect(validateNotificationConfig(validResend)).toMatchObject({
        provider: 'resend',
        resendApiKey: 're_abc123',
        mailFrom: 'TISNET <no-reply@tisnet.pe>',
      });
    });

    it.each(['RESEND_API_KEY', 'MAIL_FROM'])(
      'throws when %s is missing',
      (missingKey) => {
        const env = { ...validResend, [missingKey]: undefined };
        expect(() => validateNotificationConfig(env)).toThrow(
          'missing required env var "' + missingKey + '"',
        );
      },
    );
  });

  describe('unknown provider', () => {
    it.each(['', 'sendgrid', 'mailgun', 'FAKE', 'SMTP'])(
      'throws on unsupported provider "%s"',
      (provider) => {
        expect(() =>
          validateNotificationConfig({ NOTIFICATION_PROVIDER: provider }),
        ).toThrow();
      },
    );
  });
});