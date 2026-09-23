import {
  Injectable,
  Inject,
  Module,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeNotificationProvider,
  NOTIFICATION_PROVIDER,
  NotificationsModule,
  renderInterviewAssigned,
  renderRejectedApplication,
  NotificationTransientError,
  NotificationPermanentError,
  NotificationTimeoutError,
  describeNotificationFailure,
} from '../src/notifications';
import type { NotificationProvider } from '../src/notifications';

// A consumer module verifies exported DI wiring without importing AppModule or Prisma.
@Injectable()
class NotificationConsumer {
  constructor(
    @Inject(NOTIFICATION_PROVIDER) readonly provider: NotificationProvider,
  ) {}
}

@Module({ imports: [NotificationsModule], providers: [NotificationConsumer] })
class ConsumerModule {}

describe('Notifications module integration (no DB or external mail)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('exports the shared provider, sends both templates, and propagates failure', async () => {
    vi.stubEnv('NOTIFICATION_PROVIDER', 'fake');
    const fixture = await Test.createTestingModule({
      imports: [ConsumerModule],
    }).compile();
    const app = fixture.createNestApplication();
    try {
      await app.init();
      const consumer = app.get(NotificationConsumer);
      const fake = app.get(FakeNotificationProvider);
      expect(consumer.provider).toBe(fake);
      const candidate = {
        recipient: 'candidate@example.com',
        candidateName: 'Ana',
        requestedRole: 'DEVELOPER',
        applicationCode: 'TEAM-12345678',
      };
      await consumer.provider.send(
        renderInterviewAssigned({ ...candidate, interviewerName: 'Alex' }),
      );
      const rejected = renderRejectedApplication({
        ...candidate,
        rejectionReason: 'Otra especialidad requerida',
      });
      await consumer.provider.send(rejected);
      fake.simulateFailure(true);
      await expect(consumer.provider.send(rejected)).rejects.toThrow(
        'Simulated notification delivery failure',
      );
      expect(
        fake.getApplicationAttempts().map((attempt) => attempt.type),
      ).toEqual([
        'INTERVIEW_ASSIGNED',
        'APPLICATION_REJECTED',
        'APPLICATION_REJECTED',
      ]);
      expect(fake.getSentNotifications()).toHaveLength(2);
    } finally {
      await app.close();
    }
  });

  it('fails bootstrap when a real provider is selected but not implemented', async () => {
    vi.stubEnv('NOTIFICATION_PROVIDER', 'real');
    await expect(
      Test.createTestingModule({ imports: [NotificationsModule] }).compile(),
    ).rejects.toThrow('NOTIFICATION_PROVIDER must be fake');
  });
});

describe('Application notifications through exported Nest provider', () => {
  let app: INestApplication;
  let provider: NotificationProvider;
  let fake: FakeNotificationProvider;
  const input = {
    recipient: 'candidate@example.com',
    candidateName: 'Ana',
    requestedRole: 'DEVELOPER',
    applicationCode: 'TEAM-12345678',
    interviewerName: 'Alex',
    rejectionReason: 'Otra especialidad',
    dni: 'PRIVATE_DNI',
    cv: 'PRIVATE_CV',
    photo: 'PRIVATE_PHOTO',
    password: 'PRIVATE_PASSWORD',
    token: 'PRIVATE_TOKEN',
    privatePath: 'C:/private/PRIVATE_PATH',
    apiKey: 'PRIVATE_API_KEY',
  };

  beforeEach(async () => {
    vi.stubEnv('NOTIFICATION_PROVIDER', 'fake');
    for (const key of [
      'MAIL_API_KEY',
      'SMTP_PASSWORD',
      'NOTIFICATION_TIMEOUT_MS',
      'NOTIFICATION_MAX_RETRIES',
    ])
      vi.stubEnv(key, undefined);
    const fixture = await Test.createTestingModule({
      imports: [ConsumerModule],
    }).compile();
    app = fixture.createNestApplication();
    await app.init();
    provider = app.get(NotificationConsumer).provider;
    fake = app.get(FakeNotificationProvider);
  });

  afterEach(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it.each(['interview', 'rejection'])(
    'generates and delivers %s with minimal trace and no private extras',
    async (kind) => {
      const message =
        kind === 'interview'
          ? renderInterviewAssigned({
              ...input,
              calendlyUrl: 'https://calendly.com/tisnet/interview',
            })
          : renderRejectedApplication(input);
      expect(message.subject).toContain(input.applicationCode);
      expect(message.text).toContain(input.candidateName);
      expect(message.html).toContain(input.requestedRole);
      expect(JSON.stringify(message)).not.toContain('PRIVATE_');
      const result = await provider.send(message);
      expect(result.messageId).toBe('fake-message-1');
      expect(result.recipient).toBe(input.recipient);
      expect(fake.getApplicationAttempts()).toEqual([
        {
          type: message.metadata.type,
          recipient: input.recipient,
          applicationCode: input.applicationCode,
        },
      ]);
      expect(JSON.stringify(fake.getSentNotifications())).not.toContain(
        'PRIVATE_',
      );
      expect(fake.getLastNotification()?.html).toBeUndefined();
    },
  );

  it('escapes HTML in both messages and supports interview without Calendly', async () => {
    const hostile = `<script>alert(1)</script>&<>"'`;
    for (const message of [
      renderInterviewAssigned({
        ...input,
        candidateName: hostile,
        interviewerName: hostile,
      }),
      renderRejectedApplication({ ...input, rejectionReason: hostile }),
    ]) {
      expect(message.html).not.toContain('<script>');
      expect(message.html).toContain(
        '&lt;script&gt;alert(1)&lt;/script&gt;&amp;&lt;&gt;&quot;&#39;',
      );
      expect(message.text).toContain(hostile);
      expect(message.html).not.toContain('<a');
      await provider.send(message);
    }
    expect(fake.getSentNotifications()).toHaveLength(2);
  });

  it.each([
    new NotificationTransientError(),
    new NotificationPermanentError(),
    new NotificationTimeoutError(),
  ])(
    'propagates controlled %s to the consumer without recording success',
    async (error) => {
      fake.simulateFailure(true, error);
      await expect(
        provider.send(renderRejectedApplication(input)),
      ).rejects.toBe(error);
      expect(describeNotificationFailure(error).code).not.toBe(
        'NOTIFICATION_UNKNOWN',
      );
      expect(fake.getApplicationAttempts()).toHaveLength(1);
      expect(fake.getSentNotifications()).toHaveLength(0);
    },
  );
});
