 
 
 
 
 
 
 
 
 
 
 

 
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsDateString,
  IsNumber,
  IsPositive,
  IsArray,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

// String Field Decorator
export function StringField(options?: {
  minLength?: number;
  maxLength?: number;
  description?: string;
  example?: string;
  required?: boolean;
  toLowerCase?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    if (isRequired) {
      IsNotEmpty()(target, propertyKey);
    }

    const minLength = options?.minLength;
    if (minLength != null) {
      MinLength(minLength)(target, propertyKey);
    }

    const maxLength = options?.maxLength;
    if (maxLength != null) {
      MaxLength(maxLength)(target, propertyKey);
    }

    if (options?.toLowerCase) {
      Transform(({ value }) => value?.toLowerCase?.trim())(target, propertyKey);
    }

    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example: options?.example,
      minLength,
      maxLength,
      required: isRequired,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}

// Email Field Decorator
export function EmailField(options?: {
  description?: string;
  example?: string;
  required?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    if (isRequired) {
      IsNotEmpty()(target, propertyKey);
    }

    IsEmail()(target, propertyKey);

    Transform(({ value }) => value?.toLowerCase?.trim())(target, propertyKey);

    const example = options?.example ?? 'user@example.com';
    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example,
      format: 'email',
      required: isRequired,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}

// Password Field Decorator
export function PasswordField(options?: {
  minLength?: number;
  maxLength?: number;
  description?: string;
  example?: string;
  required?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    if (isRequired) {
      IsNotEmpty()(target, propertyKey);
    }

    const minLength = options?.minLength ?? 8;
    MinLength(minLength)(target, propertyKey);

    const maxLength = options?.maxLength;
    if (maxLength != null) {
      MaxLength(maxLength)(target, propertyKey);
    }

    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    Matches(pattern)(target, propertyKey);

    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example: options?.example ?? 'SecurePass123!',
      minLength,
      maxLength,
      format: 'password',
      required: isRequired,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}

// UUID Field Decorator
export function UUIDField(options?: {
  description?: string;
  example?: string;
  required?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    if (isRequired) {
      IsNotEmpty()(target, propertyKey);
    }

    IsUUID('4')(target, propertyKey);

    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example: options?.example ?? '550e8400-e29b-41d4-a716-446655440000',
      format: 'uuid',
      required: isRequired,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}

export function NumberField(options?: {
  min?: number;
  max?: number;
  description?: string;
  example?: number;
  required?: boolean;
  positive?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    if (isRequired) {
      IsNotEmpty()(target, propertyKey);
    }

    IsNumber()(target, propertyKey);

    const min = options?.min;
    if (min != null) {
      Min(min)(target, propertyKey);
    }

    const max = options?.max;
    if (max != null) {
      Max(max)(target, propertyKey);
    }

    if (options?.positive) {
      IsPositive()(target, propertyKey);
    }

    Transform(({ value }) => (value != null ? Number(value) : undefined))(target, propertyKey);

    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example: options?.example,
      minimum: min,
      maximum: max,
      required: isRequired,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}

export function DecimalField(options?: {
  description?: string;
  example?: number;
  required?: boolean;
  positive?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    if (isRequired) {
      IsNotEmpty()(target, propertyKey);
    }

    IsNumber()(target, propertyKey);

    if (options?.positive) {
      IsPositive()(target, propertyKey);
    }

    Transform(({ value }) => (value != null ? Number(value) : undefined))(target, propertyKey);

    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example: options?.example,
      required: isRequired,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}

export function BooleanField(options?: {
  description?: string;
  example?: boolean;
  required?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    IsBoolean()(target, propertyKey);

    Transform(({ value }) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    })(target, propertyKey);

    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example: options?.example,
      required: isRequired,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}

export function EnumField<T extends Record<string, any>>(
  enumType: T,
  options?: {
    description?: string;
    example?: string;
    required?: boolean;
    isArray?: boolean;
  },
) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    if (isRequired) {
      IsNotEmpty()(target, propertyKey);
    }

    IsEnum(enumType)(target, propertyKey);

    if (options?.isArray) {
      IsArray()(target, propertyKey);
      IsEnum(enumType, { each: true })(target, propertyKey);
    }

    const enumValues = Object.values(enumType);
    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example: options?.example ?? enumValues[0],
      enum: enumValues,
      required: isRequired,
      isArray: options?.isArray,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}

export function DateField(options?: {
  description?: string;
  example?: string;
  required?: boolean;
}) {
  return function (target: any, propertyKey: string) {
    const isRequired = options?.required !== false;

    if (isRequired) {
      IsNotEmpty()(target, propertyKey);
    }

    IsDateString()(target, propertyKey);

    Transform(({ value }) => {
      if (value == null) return undefined;
      return new Date(value);
    })(target, propertyKey);

    const apiPropertyOptions = {
      description: options?.description ?? `${propertyKey} field`,
      example: options?.example ?? '2023-01-01T00:00:00.000Z',
      format: 'date-time',
      required: isRequired,
    };

    if (isRequired) {
      ApiProperty(apiPropertyOptions)(target, propertyKey);
    } else {
      ApiPropertyOptional(apiPropertyOptions)(target, propertyKey);
    }
  };
}
