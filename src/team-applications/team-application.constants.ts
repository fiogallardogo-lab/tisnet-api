export const TEAM_APPLICATION_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  INTERVIEW_ASSIGNED: 'INTERVIEW_ASSIGNED',
  REJECTED: 'REJECTED',
} as const;

export type TeamApplicationStatus =
  (typeof TEAM_APPLICATION_STATUS)[keyof typeof TEAM_APPLICATION_STATUS];

export const TEAM_APPLICATION_ROLES = ['DEVELOPER', 'PRODUCT_OWNER'] as const;
export type TeamApplicationRole = (typeof TEAM_APPLICATION_ROLES)[number];

export const TEAM_APPLICATION_STATUSES = Object.values(
  TEAM_APPLICATION_STATUS,
) as TeamApplicationStatus[];
