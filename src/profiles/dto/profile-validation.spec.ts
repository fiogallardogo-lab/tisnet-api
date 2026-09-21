import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateClientProfileDto } from './update-client-profile.dto';
import { UpdateDeveloperProfileDto } from './update-developer-profile.dto';
import { UpdateProductOwnerProfileDto } from './update-product-owner-profile.dto';
import { UpdateAdminProfileDto } from './update-admin-profile.dto';

describe('Profile DTO validation', () => {
  it.each([
    ['dni', 8],
    ['ruc', 11],
  ] as const)('%s requires exactly numeric digits', async (field, length) => {
    for (const value of [
      '1'.repeat(length - 1),
      '1'.repeat(length + 1),
      'a'.repeat(length),
      12345678,
      '',
    ]) {
      expect(
        await validate(
          plainToInstance(UpdateClientProfileDto, { [field]: value }),
        ),
      ).not.toHaveLength(0);
    }
    expect(
      await validate(
        plainToInstance(UpdateClientProfileDto, {
          [field]: '0'.repeat(length),
        }),
      ),
    ).toHaveLength(0);
  });

  const urlFields = [
    [UpdateDeveloperProfileDto, 'cvUrl'],
    [UpdateDeveloperProfileDto, 'photoUrl'],
    [UpdateDeveloperProfileDto, 'linkedinUrl'],
    [UpdateDeveloperProfileDto, 'githubUrl'],
    [UpdateProductOwnerProfileDto, 'photoUrl'],
    [UpdateAdminProfileDto, 'photoUrl'],
    [UpdateAdminProfileDto, 'calendlyUrl'],
  ] as const;

  for (const [Dto, field] of urlFields) {
    it(`${Dto.name}.${field} allows only optional HTTP(S) URLs up to 500 characters`, async () => {
      const validateValue = (value: unknown) =>
        validate(plainToInstance(Dto as new () => object, { [field]: value }));
      for (const value of [
        undefined,
        null,
        'http://example.com',
        'https://example.com/' + 'a'.repeat(480),
      ]) {
        expect(await validateValue(value)).toHaveLength(0);
      }
      for (const value of [
        'example.com',
        '//example.com',
        'ftp://example.com',
        'javascript:alert(1)',
        'https://example.com/' + 'a'.repeat(482),
      ]) {
        expect(await validateValue(value)).not.toHaveLength(0);
      }
    });
  }

  it('accepts repeated technology IDs for service deduplication, but rejects invalid lists', async () => {
    for (const technologyIds of [undefined, [], [1, 1, 2]]) {
      expect(
        await validate(
          plainToInstance(UpdateDeveloperProfileDto, { technologyIds }),
        ),
      ).toHaveLength(0);
    }
    for (const technologyIds of [null, '1', [0], [-1], [1.2], ['1']]) {
      expect(
        await validate(
          plainToInstance(UpdateDeveloperProfileDto, { technologyIds }),
        ),
      ).not.toHaveLength(0);
    }
  });
});
