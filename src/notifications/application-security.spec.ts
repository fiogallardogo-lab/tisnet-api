import { describe, expect, it } from 'vitest';
import { FakeNotificationProvider } from './fake-notification.provider';
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
const attacks = [
  ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
] as const;

describe.each([
  'candidateName',
  'applicationCode',
  'requestedRole',
  'interviewerName',
  'rejectionReason',
] as const)('HTML security: %s', (field) => {
  it.each(attacks)(
    'escapes %s in HTML and preserves plain text',
    (raw, escaped) => {
      const input = {
        ...candidate,
        interviewerName: 'Alex',
        rejectionReason: 'Otra especialidad',
        [field]: raw,
      };
      const message =
        field === 'rejectionReason'
          ? renderRejectedApplication(input)
          : renderInterviewAssigned(input);
      expect(message.html).toContain(escaped);
      expect(message.html).not.toContain('<script>');
      expect(message.text).toContain(raw);
      if (field === 'candidateName')
        expect(message.html).toContain(`Hola, ${escaped}.`);
      if (field === 'applicationCode')
        expect(message.html).toContain(`<strong>${escaped}</strong>`);
      if (field === 'requestedRole')
        expect(message.html).toContain(`para el rol ${escaped}`);
      if (field === 'interviewerName')
        expect(message.html).toContain(`será ${escaped}.`);
      if (field === 'rejectionReason')
        expect(message.html).toContain(`Motivo: ${escaped}`);
    },
  );
});

describe('Minimal application payloads', () => {
  it.each(['interview', 'rejection'])(
    'does not retain private extra fields in %s messages or fake records',
    async (kind) => {
      const privateFields = {
        dni: 'PRIVATE_DNI',
        cv: 'PRIVATE_CV',
        photo: 'PRIVATE_PHOTO',
        privatePath: 'C:/private/PRIVATE_PATH.pdf',
        accessToken: 'PRIVATE_ACCESS_TOKEN',
        refreshToken: 'PRIVATE_REFRESH_TOKEN',
        password: 'PRIVATE_PASSWORD',
        apiKey: 'PRIVATE_API_KEY',
        secret: 'PRIVATE_SECRET',
        authorization: 'PRIVATE_AUTHORIZATION',
      };
      const input = {
        ...candidate,
        ...privateFields,
        interviewerName: 'Alex',
        rejectionReason: 'Otra especialidad',
      };
      const message =
        kind === 'interview'
          ? renderInterviewAssigned(input)
          : renderRejectedApplication(input);
      expect(Object.keys(message).sort()).toEqual([
        'html',
        'metadata',
        'recipient',
        'subject',
        'text',
      ]);
      expect(Object.keys(message.metadata).sort()).toEqual([
        'applicationCode',
        'type',
      ]);
      const fake = new FakeNotificationProvider();
      await fake.send({
        ...message,
        ...privateFields,
        metadata: { ...message.metadata, ...privateFields },
        attachments: [
          {
            filename: privateFields.privatePath,
            mimeType: 'application/pdf',
            content: Buffer.from(privateFields.cv),
          },
        ],
      });
      for (const value of Object.values(privateFields)) {
        expect(JSON.stringify(message)).not.toContain(value);
        expect(JSON.stringify(fake.getSentNotifications())).not.toContain(
          value,
        );
        expect(JSON.stringify(fake.getApplicationAttempts())).not.toContain(
          value,
        );
      }
      expect(fake.getApplicationAttempts()).toEqual([
        {
          type: message.metadata.type,
          recipient: candidate.recipient,
          applicationCode: candidate.applicationCode,
        },
      ]);
    },
  );
});
