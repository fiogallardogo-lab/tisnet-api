import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function HasPhoneDigitCount(
  minimum: number,
  maximum: number,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'hasPhoneDigitCount',
      target: object.constructor,
      propertyName,
      constraints: [minimum, maximum],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const digitCount = value.replace(/\D/g, '').length;
          return digitCount >= minimum && digitCount <= maximum;
        },
        defaultMessage(args: ValidationArguments) {
          const [min, max] = args.constraints as [number, number];
          return `El teléfono debe contener entre ${min} y ${max} dígitos`;
        },
      },
    });
  };
}
