import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateOwnUserDto } from './update-own-user.dto';

describe('UpdateOwnUserDto legal acceptance', () => {
  const legal = {
    acceptedTerms: true,
    termsVersion: 'v2',
    privacyVersion: 'v2',
  };
  it.each([{ name: 'Cliente' }, legal, { name: 'Cliente', ...legal }])(
    'allows a complete update %j',
    async (body) => {
      expect(
        await validate(plainToInstance(UpdateOwnUserDto, body)),
      ).toHaveLength(0);
    },
  );
  it.each([
    { termsVersion: 'v2' },
    { privacyVersion: 'v2' },
    { acceptedTerms: true },
    { ...legal, acceptedTerms: false },
    { ...legal, acceptedTerms: null },
    { ...legal, termsVersion: null },
    { ...legal, privacyVersion: null },
    { ...legal, termsVersion: '   ' },
    { ...legal, privacyVersion: '' },
    { ...legal, termsVersion: 'a'.repeat(51) },
    { ...legal, privacyVersion: 1 },
  ])('rejects incomplete or invalid acceptance %j', async (body) => {
    expect(
      await validate(plainToInstance(UpdateOwnUserDto, body)),
    ).not.toHaveLength(0);
  });
});
