import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { COMMON_PASSWORDS } from './common-passwords';

export function IsNotCommonPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotCommonPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return true;
          return !COMMON_PASSWORDS.has(value.toLowerCase());
        },
        defaultMessage(_args: ValidationArguments) {
          return 'Password is too commonly used. Please choose a more unique password.';
        },
      },
    });
  };
}
