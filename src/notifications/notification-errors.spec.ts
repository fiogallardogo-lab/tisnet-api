import { describe, expect, it, vi, afterEach } from 'vitest';
import { FakeNotificationProvider } from './fake-notification.provider';
import { NotificationDeliveryError } from './notification-provider.interface';
import {
  describeNotificationFailure,
  NotificationPermanentError,
  NotificationTimeoutError,
  NotificationTransientError,
} from './notification-errors';
import {
  renderInterviewAssigned,
  renderRejectedApplication,
} from './templates/application-notifications';

const candidate = {
  recipient: 'candidate@example.com',
  candidateName: 'Ana',
  applicationCode: 'TEAM-12345678',
  requestedRole: 'DEVELOPER',
};
const messages = [
  renderInterviewAssigned({ ...candidate, interviewerName: 'Alex' }),
  renderRejectedApplication({
    ...candidate,
    rejectionReason: 'Otra especialidad',
  }),
];

describe('Controlled notification failures', () => {
  afterEach(() => vi.restoreAllMocks());
  it.each([
    [new NotificationTransientError(), 'NOTIFICATION_TRANSIENT', true],
    [new NotificationPermanentError(), 'NOTIFICATION_PERMANENT', false],
    [new NotificationTimeoutError(), 'NOTIFICATION_TIMEOUT', true],
  ] as const)(
    'simulates %s without network, waiting or retries',
    async (error, code, retryable) => {
      expect(error).toBeInstanceOf(NotificationDeliveryError);
      expect(describeNotificationFailure(error)).toEqual({ code, retryable });
      for (const message of messages) {
        const fake = new FakeNotificationProvider();
        fake.simulateFailure(true, error);
        await expect(fake.send(message)).rejects.toBe(error);
        expect(fake.getApplicationAttempts()).toEqual([
          {
            type: message.metadata.type,
            recipient: candidate.recipient,
            applicationCode: candidate.applicationCode,
          },
        ]);
        expect(fake.getSentNotifications()).toEqual([]);
        fake.simulateFailure(false);
        expect((await fake.send(message)).messageId).toBe('fake-message-1');
        fake.clear();
        expect(fake.getApplicationAttempts()).toEqual([]);
      }
    },
  );

  it.each([
    new NotificationDeliveryError('PRIVATE_SECRET'),
    new Error('PRIVATE_TOKEN'),
    { response: 'PRIVATE_PASSWORD' },
    null,
    undefined,
  ])('projects unknown errors without exposing their content', (error) => {
    expect(describeNotificationFailure(error)).toEqual({
      code: 'NOTIFICATION_UNKNOWN',
      retryable: false,
    });
    expect(JSON.stringify(describeNotificationFailure(error))).not.toContain(
      'PRIVATE_',
    );
  });

  it('does not log payloads or raw errors for either notification type', async () => {
    const spies = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'info'),
      vi.spyOn(console, 'debug'),
    ];
    const fake = new FakeNotificationProvider();
    for (const message of messages) {
      fake.simulateFailure(false);
      await fake.send(message);
      fake.simulateFailure(true, new Error('PRIVATE_API_KEY'));
      await expect(fake.send(message)).rejects.toThrow('PRIVATE_API_KEY');
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
