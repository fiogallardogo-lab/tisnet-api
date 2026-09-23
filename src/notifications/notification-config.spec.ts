import { describe, expect, it } from 'vitest';
import { validateNotificationConfig } from '../config/notification.validation';

describe('Notification configuration', () => {
  it('defaults to fake without credentials', () => {
    expect(validateNotificationConfig({})).toEqual({ provider: 'fake' });
    expect(
      validateNotificationConfig({ NOTIFICATION_PROVIDER: 'fake' }),
    ).toEqual({ provider: 'fake' });
  });

  it.each(['', 'smtp', 'resend', 'sendgrid', 'real', 'FAKE'])(
    'rejects unsupported provider %s without silent fallback',
    (provider) => {
      expect(() =>
        validateNotificationConfig({ NOTIFICATION_PROVIDER: provider }),
      ).toThrow('NOTIFICATION_PROVIDER must be fake');
    },
  );
});
