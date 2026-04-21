import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';

export interface ValidateConfigOptions {
  skipMissingProperties?: boolean;
}

export function validateConfig<T extends object>(
  config: Record<string, unknown>,
  envVariablesClass: new () => T,
  options: ValidateConfigOptions = {},
): T {
  const validatedConfig = plainToInstance(envVariablesClass, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: options.skipMissingProperties ?? false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error: ValidationError) => {
      const constraints = Object.values(error.constraints ?? {});
      return `${error.property}: ${constraints.join(', ')}`;
    });

    throw new Error(`Configuration validation failed: ${errorMessages.join('; ')}`);
  }

  return validatedConfig;
}

export function formatValidationError(error: Error): string {
  if (error.message.includes('Configuration validation failed')) {
    return error.message;
  }

  return `Configuration error: ${error.message}`;
}
