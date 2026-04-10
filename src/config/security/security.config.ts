import { registerAs } from '@nestjs/config';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SecurityConfig } from './security-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  ALLOWED_ORIGINS!: string;

  @IsArray()
  @IsOptional()
  ALLOWED_METHODS!: string[];

  @IsArray()
  @IsOptional()
  ALLOWED_HEADERS!: string[];

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  CORS_CREDENTIALS!: boolean;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return parseInt(value, 10);
  })
  @IsInt()
  @IsOptional()
  CORS_MAX_AGE!: number;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  HELMET_CSP!: boolean;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  HELMET_HSTS!: boolean;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  HELMET_NO_SNIFF!: boolean;
}

function parseAllowedOrigins(originsStr: string | undefined): string[] {
  if (!originsStr) {
    return ['http://localhost:3000', 'http://localhost:5173'];
  }

  return originsStr
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export default registerAs<SecurityConfig>('security', () => {
  const validatedConfig = validateConfig(
    process.env,
    EnvironmentVariablesValidator,
    { skipMissingProperties: true },
  );

  const allowedOrigins = parseAllowedOrigins(validatedConfig.ALLOWED_ORIGINS);
  const allowedMethods = validatedConfig.ALLOWED_METHODS || [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
  ];
  const allowedHeaders = validatedConfig.ALLOWED_HEADERS || [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Correlation-ID',
  ];

  return {
    cors: {
      allowedOrigins,
      allowedMethods,
      allowedHeaders,
      credentials: validatedConfig.CORS_CREDENTIALS ?? false,
      maxAge: validatedConfig.CORS_MAX_AGE ?? 86400,
    },
    helmet: {
      contentSecurityPolicy: validatedConfig.HELMET_CSP !== false,
      hsts: validatedConfig.HELMET_HSTS !== false,
      noSniff: validatedConfig.HELMET_NO_SNIFF !== false,
    },
  };
});
