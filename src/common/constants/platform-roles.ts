/** Canonical role identifiers approved for Sprint 3. */
export const PLATFORM_ROLES = {
  CLIENT: 'CLIENT',
  DEVELOPER: 'DEVELOPER',
  PRODUCT_OWNER: 'PRODUCT_OWNER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];
