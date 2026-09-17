import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

const ROOT_FIELDS = new Set([
  'solutionType',
  'options',
  'contact',
  'notes',
  'deliveryMode',
]);
const CONTACT_FIELDS = new Set(['fullName', 'email', 'phone', 'company']);
const OPTION_FIELDS = new Set(['code']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): string[] {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

/**
 * Se ejecuta antes de los pipes globales para que whitelist no elimine en
 * silencio campos desconocidos del payload público de Quotes.
 */
@Injectable()
export class RejectUnknownQuoteFieldsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const body = context.switchToHttp().getRequest<{ body: unknown }>().body;

    if (!isRecord(body)) return next.handle();

    const violations = unknownFields(body, ROOT_FIELDS).map(
      (field) => `body.${field}`,
    );

    if (isRecord(body.contact)) {
      violations.push(
        ...unknownFields(body.contact, CONTACT_FIELDS).map(
          (field) => `body.contact.${field}`,
        ),
      );
    }

    if (Array.isArray(body.options)) {
      body.options.forEach((option, index) => {
        if (!isRecord(option)) return;
        violations.push(
          ...unknownFields(option, OPTION_FIELDS).map(
            (field) => `body.options[${index}].${field}`,
          ),
        );
      });
    }

    if (violations.length > 0) {
      throw new BadRequestException(
        `El body contiene campos no permitidos: ${violations.join(', ')}`,
      );
    }

    return next.handle();
  }
}
