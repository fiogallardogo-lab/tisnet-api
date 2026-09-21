import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** The server configuration is the source of truth for approved versions. */
export function validateLegalVersions(
  config: ConfigService,
  input: { termsVersion?: string; privacyVersion?: string },
) {
  const termsVersion = config.get<string>('TERMS_VERSION')?.trim();
  const privacyVersion = config.get<string>('PRIVACY_VERSION')?.trim();
  if (
    !termsVersion ||
    !privacyVersion ||
    termsVersion.length > 50 ||
    privacyVersion.length > 50
  ) {
    throw new ServiceUnavailableException(
      'Las versiones legales no están configuradas',
    );
  }
  if (
    input.termsVersion !== termsVersion ||
    input.privacyVersion !== privacyVersion
  ) {
    throw new BadRequestException(
      'Las versiones de términos o privacidad no son vigentes',
    );
  }
  return { termsVersion, privacyVersion };
}
