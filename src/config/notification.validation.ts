export interface NotificationConfig {
  provider: 'fake';
}

export function validateNotificationConfig(
  env: Record<string, string | undefined>,
): NotificationConfig {
  const provider = env.NOTIFICATION_PROVIDER ?? 'fake';
  if (provider !== 'fake') {
    // Never silently simulate delivery when an operator requested a real provider.
    throw new Error(
      'NOTIFICATION_PROVIDER must be fake; a real mail provider has not been approved or implemented',
    );
  }
  return { provider };
}
