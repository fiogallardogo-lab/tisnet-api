import { describe, expect, it } from 'vitest';
import { FakeNotificationProvider } from './fake-notification.provider';
import { NotificationDeliveryError } from './notification-provider.interface';
import {
  renderInterviewAssigned,
  renderRejectedApplication,
} from './templates/application-notifications';
import { escapeHtml } from './templates/escape-html';

const candidate = {
  recipient: 'candidate@example.com',
  candidateName: 'Ana',
  applicationCode: 'TEAM-12345678',
  requestedRole: 'DEVELOPER',
};

describe('Application notification templates', () => {
  it('renders all interview fields in both formats with trace metadata', () => {
    const message = renderInterviewAssigned({
      ...candidate,
      interviewerName: 'Alex',
      calendlyUrl: 'https://calendly.com/tisnet/interview?a=1&b=2',
    });
    expect(message.subject).toBe(
      'Entrevista asignada — Postulación TEAM-12345678',
    );
    for (const value of ['Ana', 'TEAM-12345678', 'DEVELOPER', 'Alex']) {
      expect(message.text).toContain(value);
      expect(message.html).toContain(value);
    }
    expect(message.text).toContain(
      'https://calendly.com/tisnet/interview?a=1&b=2',
    );
    expect(message.html).toContain(
      'href="https://calendly.com/tisnet/interview?a=1&amp;b=2"',
    );
    expect(message.metadata).toEqual({
      type: 'INTERVIEW_ASSIGNED',
      applicationCode: candidate.applicationCode,
    });
  });

  it.each([undefined, null, '', '   '])(
    'handles absent Calendly URL (%s)',
    (calendlyUrl) => {
      const message = renderInterviewAssigned({
        ...candidate,
        interviewerName: 'Alex',
        calendlyUrl,
      });
      expect(message.html).not.toContain('<a');
      expect(message.text).toContain('se pondrá en contacto');
      expect(message.text).not.toMatch(/undefined|null/);
    },
  );

  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'http://calendly.com/test',
    '//calendly.com/test',
    'invalid',
    'https://user:password@calendly.com/test',
  ])('rejects unsafe URL %s', (calendlyUrl) => {
    expect(() =>
      renderInterviewAssigned({
        ...candidate,
        interviewerName: 'Alex',
        calendlyUrl,
      }),
    ).toThrow();
  });

  it('renders rejection and respectful closing in both formats', () => {
    const message = renderRejectedApplication({
      ...candidate,
      rejectionReason: 'La experiencia requerida es distinta.',
    });
    expect(message.subject).toBe('Resultado de postulación — TEAM-12345678');
    for (const value of [
      'Ana',
      'TEAM-12345678',
      'DEVELOPER',
      'La experiencia requerida es distinta.',
      'Agradecemos tu tiempo',
    ]) {
      expect(message.text).toContain(value);
      expect(message.html).toContain(value);
    }
    expect(message.metadata).toEqual({
      type: 'APPLICATION_REJECTED',
      applicationCode: candidate.applicationCode,
    });
  });

  it('escapes every dynamic HTML text field without altering plain text', () => {
    const hostile = `<script>alert("x" & 'y')</script> < >`;
    const input = {
      ...candidate,
      candidateName: hostile,
      applicationCode: hostile,
      requestedRole: hostile,
    };
    const messages = [
      renderInterviewAssigned({ ...input, interviewerName: hostile }),
      renderRejectedApplication({ ...input, rejectionReason: hostile }),
    ];
    for (const message of messages) {
      expect(message.html).not.toContain('<script>');
      expect(message.html.match(/&lt;script&gt;/g)).toHaveLength(4);
      expect(message.html).toContain('&quot;x&quot; &amp; &#39;y&#39;');
      expect(message.text).toContain(hostile);
    }
  });

  it('escapes HTML metacharacters and safely retains rejection line breaks', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    const message = renderRejectedApplication({
      ...candidate,
      rejectionReason: '<img src=x onerror=alert(1)>\nGracias',
    });
    expect(message.html).toContain(
      '&lt;img src=x onerror=alert(1)&gt;<br>Gracias',
    );
    expect(message.html).not.toContain('<img');
  });

  it('does not copy unrelated private fields or attachments', () => {
    const message = renderRejectedApplication({
      ...candidate,
      rejectionReason: 'Perfil distinto',
      dni: 'PRIVATE_DNI',
      cv: 'PRIVATE_CV',
      password: 'PRIVATE_PASSWORD',
      token: 'PRIVATE_TOKEN',
    } as Parameters<typeof renderRejectedApplication>[0]);
    expect(JSON.stringify(message)).not.toContain('PRIVATE_');
    expect(message.attachments).toBeUndefined();
  });

  it('rejects header injection and incomplete notification data', () => {
    expect(() =>
      renderRejectedApplication({
        ...candidate,
        applicationCode: 'TEAM-123\r\nBcc: other@example.com',
        rejectionReason: 'Reason',
      }),
    ).toThrow('applicationCode');
    expect(() =>
      renderRejectedApplication({
        ...candidate,
        recipient: 'bad\r\n@example.com',
        rejectionReason: 'Reason',
      }),
    ).toThrow('recipient');
    expect(() =>
      renderRejectedApplication({ ...candidate, rejectionReason: '  ' }),
    ).toThrow('text');
  });
});

describe('Fake application delivery privacy and attempts', () => {
  it('records successful and failed attempts without retaining bodies, attachments or arbitrary metadata', async () => {
    const fake = new FakeNotificationProvider();
    const message = renderRejectedApplication({
      ...candidate,
      rejectionReason: 'PRIVATE_REASON',
    });
    const input = {
      ...message,
      metadata: { ...message.metadata, token: 'PRIVATE_TOKEN' },
      attachments: [
        {
          filename: 'PRIVATE_CV',
          mimeType: 'application/pdf',
          content: Buffer.from('PRIVATE_CV'),
        },
      ],
    };
    await fake.send(input);
    fake.simulateFailure(true);
    await expect(fake.send(input)).rejects.toBeInstanceOf(
      NotificationDeliveryError,
    );
    expect(fake.getApplicationAttempts()).toEqual(
      Array(2).fill({
        type: 'APPLICATION_REJECTED',
        recipient: candidate.recipient,
        applicationCode: candidate.applicationCode,
      }),
    );
    expect(fake.getSentNotifications()).toHaveLength(1);
    expect(JSON.stringify(fake.getSentNotifications())).not.toContain(
      'PRIVATE_',
    );
    expect(JSON.stringify(fake.getApplicationAttempts())).not.toContain(
      'PRIVATE_',
    );
    expect(fake.getLastNotification()?.text).toBeUndefined();
    expect(fake.getLastNotification()?.html).toBeUndefined();
    expect(fake.getLastNotification()?.attachments).toBeUndefined();
    const trace = fake.getApplicationAttempts()[0];
    trace.applicationCode = 'changed';
    expect(fake.getApplicationAttempts()[0].applicationCode).toBe(
      candidate.applicationCode,
    );
    fake.clear();
    expect(fake.getApplicationAttempts()).toEqual([]);
    expect((await fake.send(message)).messageId).toBe('fake-message-1');
  });

  it('requires applicationCode for application messages', async () => {
    await expect(
      new FakeNotificationProvider().send({
        recipient: candidate.recipient,
        subject: 'test',
        metadata: { type: 'INTERVIEW_ASSIGNED' },
      }),
    ).rejects.toThrow('applicationCode');
  });
});
