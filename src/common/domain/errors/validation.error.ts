export class ValidationError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly value?: unknown;

  constructor(message: string, code: string, field?: string, value?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
    this.value = value;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common validation errors
export class RequiredFieldError extends ValidationError {
  constructor(field: string) {
    super(`Field "${field}" is required`, 'REQUIRED_FIELD', field);
  }
}

export class InvalidFormatError extends ValidationError {
  constructor(field: string, format: string, value?: unknown) {
    super(`Field "${field}" must be a valid ${format}`, 'INVALID_FORMAT', field, value);
  }
}

export class InvalidLengthError extends ValidationError {
  constructor(field: string, min?: number, max?: number, value?: unknown) {
    let message = `Field "${field}"`;
    if (min != null && max != null) {
      message += ` must be between ${min} and ${max} characters`;
    } else if (min != null) {
      message += ` must be at least ${min} characters`;
    } else if (max != null) {
      message += ` must be at most ${max} characters`;
    }

    super(message, 'INVALID_LENGTH', field, value);
  }
}

export class InvalidEmailFormatError extends ValidationError {
  constructor(email: string) {
    super(`Invalid email format: "${email}"`, 'INVALID_EMAIL_FORMAT', 'email', email);
  }
}

export class InvalidPasswordError extends ValidationError {
  constructor(reason: string) {
    super(`Password validation failed: ${reason}`, 'INVALID_PASSWORD', 'password');
  }
}

export class InvalidUuidError extends ValidationError {
  constructor(value: string) {
    super(`Invalid UUID format: "${value}"`, 'INVALID_UUID', 'id', value);
  }
}

export class InvalidEnumValueError extends ValidationError {
  constructor(field: string, enumValues: string[], value?: unknown) {
    super(
      `Field "${field}" must be one of: ${enumValues.join(', ')}`,
      'INVALID_ENUM_VALUE',
      field,
      value,
    );
  }
}
