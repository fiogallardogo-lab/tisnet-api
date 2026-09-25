import type { SendNotificationInput } from './notification-provider.interface';

export type ApplicationNotificationType =
  | 'INTERVIEW_ASSIGNED'
  | 'APPLICATION_REJECTED'
  | 'APPLICATION_RECEIVED'
  | 'APPLICATION_ACCEPTED';

interface ApplicationNotification {
  recipient: string;
  candidateName: string;
  applicationCode: string;
  requestedRole: string;
}

export interface InterviewAssignedNotification extends ApplicationNotification {
  interviewerName: string;
  calendlyUrl?: string | null;
}

export interface RejectedApplicationNotification extends ApplicationNotification {
  rejectionReason: string;
}

export interface ApplicationReceivedNotification extends ApplicationNotification {
  confirmationNotes?: string;
}

export interface ApplicationAcceptedNotification extends ApplicationNotification {
  nextSteps?: string;
  onboardingUrl?: string | null;
}

export interface ApplicationNotificationMessage extends SendNotificationInput {
  text: string;
  html: string;
  metadata: {
    type: ApplicationNotificationType;
    applicationCode: string;
  };
}

/** Minimal in-memory trace, including failed attempts. Never includes message bodies. */
export interface ApplicationNotificationAttempt {
  type: ApplicationNotificationType;
  recipient: string;
  applicationCode: string;
}
