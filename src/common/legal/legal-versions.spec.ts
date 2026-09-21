import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { validateLegalVersions } from './legal-versions';

describe('validateLegalVersions', () => {
  const input = { termsVersion: 'terms-v2', privacyVersion: 'privacy-v3' };
  it('returns only the configured approved versions', () => {
    const config = new ConfigService({
      TERMS_VERSION: 'terms-v2',
      PRIVACY_VERSION: 'privacy-v3',
    });
    expect(validateLegalVersions(config, input)).toEqual(input);
  });
  it.each([undefined, '', '  ', 'a'.repeat(51)])(
    'rejects invalid server configuration: %s',
    (version) => {
      for (const key of ['TERMS_VERSION', 'PRIVACY_VERSION']) {
        const config = new ConfigService({
          TERMS_VERSION: 'terms-v2',
          PRIVACY_VERSION: 'privacy-v3',
          [key]: version,
        });
        expect(() => validateLegalVersions(config, input)).toThrow(
          ServiceUnavailableException,
        );
      }
    },
  );
  it.each(['termsVersion', 'privacyVersion'])('rejects a stale %s', (key) => {
    const config = new ConfigService({
      TERMS_VERSION: 'terms-v2',
      PRIVACY_VERSION: 'privacy-v3',
    });
    expect(() =>
      validateLegalVersions(config, { ...input, [key]: 'old' }),
    ).toThrow(BadRequestException);
  });
});
