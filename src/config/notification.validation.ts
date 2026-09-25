export type NotificationProvider = 'fake' | 'smtp' | 'resend';

interface BaseNotificationConfig {
  provider: NotificationProvider;
  mailFrom: string;
}

export interface FakeNotificationConfig extends BaseNotificationConfig {
  provider: 'fake';
  mailFrom: '';
}

export interface SmtpNotificationConfig extends BaseNotificationConfig {
  provider: 'smtp';
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
}

export interface ResendNotificationConfig extends BaseNotificationConfig {
  provider: 'resend';
  resendApiKey: string;
}

export type NotificationConfig =
  | FakeNotificationConfig
  | SmtpNotificationConfig
  | ResendNotificationConfig;

function requireEnv(
  env: Record<string, string | undefined>,
  key: string,
  context: string,
): string {
  const value = env[key];
  if (!value || !value.trim()) {
    throw new Error(
      '[Notifications] ' + context + ': missing required env var "' + key + '"',
    );
  }
  return value.trim();
}

function parsePort(raw: string | undefined, context: string): number {
  const parsed = parseInt(raw ?? '587', 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(
      '[Notifications] ' + context + ': SMTP_PORT must be a valid port number (1-65535), got "' + raw + '"',
    );
  }
  return parsed;
}

export function validateNotificationConfig(
  env: Record<string, string | undefined>,
): NotificationConfig {
  const provider = (env.NOTIFICATION_PROVIDER ?? 'fake').trim() as NotificationProvider;

  if (provider === 'fake') {
    return { provider: 'fake', mailFrom: '' };
  }

  if (provider === 'smtp') {
    const context = 'provider=smtp';
    return {
      provider: 'smtp',
      smtpHost: requireEnv(env, 'SMTP_HOST', context),
      smtpPort: parsePort(env.SMTP_PORT, context),
      smtpUser: requireEnv(env, 'SMTP_USER', context),
      smtpPass: requireEnv(env, 'SMTP_PASS', context),
      smtpSecure: (env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false',
      mailFrom: requireEnv(env, 'MAIL_FROM', context),
    };
  }

  if (provider === 'resend') {
    const context = 'provider=resend';
    return {
      provider: 'resend',
      resendApiKey: requireEnv(env, 'RESEND_API_KEY', context),
      mailFrom: requireEnv(env, 'MAIL_FROM', context),
    };
  }

  throw new Error(
    '[Notifications] Unknown NOTIFICATION_PROVIDER="' + provider + '". Valid values: fake | smtp | resend',
  );
}