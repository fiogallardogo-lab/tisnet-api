import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreatePublicQuoteDto } from './create-public-quote.dto';
import { QuoteDeliveryMode } from '../domain/quote.enums';

const validPayload = {
  solutionType: 'web_app',
  options: [{ code: 'authentication' }, { code: 'reports' }],
  contact: {
    fullName: ' Ana Torres ',
    email: ' ANA.TORRES@EXAMPLE.COM ',
    phone: '+51 987 654 321',
    company: 'Empresa Ejemplo SAC',
  },
  notes: 'Primera versión',
};

describe('CreatePublicQuoteDto', () => {
  it('debe transformar y aceptar un payload válido', async () => {
    const dto = plainToInstance(CreatePublicQuoteDto, validPayload);

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.solutionType).toBe('WEB_APP');
    expect(dto.options.map(({ code }) => code)).toEqual([
      'AUTHENTICATION',
      'REPORTS',
    ]);
    expect(dto.contact.email).toBe('ana.torres@example.com');
  });

  it('debe aceptar y normalizar modalidades válidas de entrega', async () => {
    const dtoUrgent = plainToInstance(CreatePublicQuoteDto, {
      ...validPayload,
      deliveryMode: ' urgent ',
    });
    expect(await validate(dtoUrgent)).toHaveLength(0);
    expect(dtoUrgent.deliveryMode).toBe(QuoteDeliveryMode.URGENT);

    const dtoFlexible = plainToInstance(CreatePublicQuoteDto, {
      ...validPayload,
      deliveryMode: 'FLEXIBLE',
    });
    expect(await validate(dtoFlexible)).toHaveLength(0);
    expect(dtoFlexible.deliveryMode).toBe(QuoteDeliveryMode.FLEXIBLE);
  });

  it('debe rechazar una modalidad de entrega no permitida', async () => {
    const dto = plainToInstance(CreatePublicQuoteDto, {
      ...validPayload,
      deliveryMode: 'SUPER_FAST',
    });

    const errors = await validate(dto);
    expect(errors.some(({ property }) => property === 'deliveryMode')).toBe(true);
  });

  it('debe rechazar opciones duplicadas después de normalizar códigos', async () => {
    const dto = plainToInstance(CreatePublicQuoteDto, {
      ...validPayload,
      options: [{ code: 'AUTH' }, { code: ' auth ' }],
    });

    const errors = await validate(dto);
    expect(errors.some(({ property }) => property === 'options')).toBe(true);
  });

  it('debe rechazar teléfonos con menos de siete dígitos', async () => {
    const dto = plainToInstance(CreatePublicQuoteDto, {
      ...validPayload,
      contact: { ...validPayload.contact, phone: '+51 123' },
    });

    const errors = await validate(dto);
    const contactError = errors.find(({ property }) => property === 'contact');
    expect(contactError?.children?.[0].property).toBe('phone');
  });

  it('el pipe global puede eliminar extras; el interceptor HTTP debe rechazarlos antes', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const result = (await pipe.transform(
      {
        ...validPayload,
        status: 'CALCULATED',
        amountMinor: 1,
        options: [{ code: 'AUTH', price: 1 }],
        contact: { ...validPayload.contact, internalNote: 'no permitido' },
      },
      { type: 'body', metatype: CreatePublicQuoteDto },
    )) as CreatePublicQuoteDto;

    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('amountMinor');
    expect(result.options[0]).not.toHaveProperty('price');
    expect(result.contact).not.toHaveProperty('internalNote');
  });

  it('debe rechazar una lista vacía de opciones', async () => {
    const dto = plainToInstance(CreatePublicQuoteDto, {
      ...validPayload,
      options: [],
    });

    const errors = await validate(dto);
    expect(errors.some(({ property }) => property === 'options')).toBe(true);
  });
});
