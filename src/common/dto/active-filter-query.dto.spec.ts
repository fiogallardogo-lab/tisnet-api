import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ActiveFilterQueryDto } from './active-filter-query.dto';

describe('ActiveFilterQueryDto', () => {
  it('debe convertir "true" a true', async () => {
    const dto = plainToInstance(ActiveFilterQueryDto, { isActive: 'true' });

    expect(dto.isActive).toBe(true);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('debe convertir "false" a false', async () => {
    const dto = plainToInstance(ActiveFilterQueryDto, { isActive: 'false' });

    expect(dto.isActive).toBe(false);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('debe rechazar valores que no sean booleanos', async () => {
    const dto = plainToInstance(ActiveFilterQueryDto, { isActive: 'active' });

    expect(await validate(dto)).toHaveLength(1);
  });
});
