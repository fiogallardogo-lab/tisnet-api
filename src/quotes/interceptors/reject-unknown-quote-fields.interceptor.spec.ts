import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { RejectUnknownQuoteFieldsInterceptor } from './reject-unknown-quote-fields.interceptor';

function contextWithBody(body: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

const next: CallHandler = { handle: () => of('ok') };

describe('RejectUnknownQuoteFieldsInterceptor', () => {
  const interceptor = new RejectUnknownQuoteFieldsInterceptor();

  it('debe permitir únicamente los campos definidos por el contrato', () => {
    const result = interceptor.intercept(
      contextWithBody({
        solutionType: 'WEB_APP',
        options: [{ code: 'AUTH' }],
        contact: {
          fullName: 'Ana Torres',
          email: 'ana@example.com',
          phone: '987654321',
          company: 'Empresa SAC',
        },
        notes: 'Primera versión',
      }),
      next,
    );

    expect(result).toBeDefined();
  });

  it('debe permitir deliveryMode como campo raíz válido', () => {
    const result = interceptor.intercept(
      contextWithBody({
        solutionType: 'ECOMMERCE',
        options: [{ code: 'SEO_ADVANCED' }],
        deliveryMode: 'URGENT',
        contact: {
          fullName: 'Ana Torres',
          email: 'ana@example.com',
          phone: '987654321',
        },
      }),
      next,
    );

    expect(result).toBeDefined();
  });

  it('debe rechazar campos administrativos y extras anidados', () => {
    expect(() =>
      interceptor.intercept(
        contextWithBody({
          solutionType: 'WEB_APP',
          status: 'CALCULATED',
          amountMinor: 1,
          options: [{ code: 'AUTH', price: 1 }],
          contact: {
            fullName: 'Ana Torres',
            email: 'ana@example.com',
            phone: '987654321',
            internalNote: 'no permitido',
          },
        }),
        next,
      ),
    ).toThrow(
      new BadRequestException(
        'El body contiene campos no permitidos: body.status, body.amountMinor, body.contact.internalNote, body.options[0].price',
      ),
    );
  });

  it('debe delegar la validación de tipos a los DTOs', () => {
    expect(
      interceptor.intercept(contextWithBody('body inválido'), next),
    ).toBeDefined();
  });
});
