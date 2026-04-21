import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsInt, IsBoolean, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { AuthConfig } from './auth-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';
import { toOptionalInt } from '@/common/utils/config/env-transform.util';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  AUTH_JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsOptional()
  AUTH_JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  AUTH_JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  AUTH_JWT_REFRESH_EXPIRES_IN!: string;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  AUTH_SESSION_MAX_ACTIVE!: number;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  AUTH_SESSION_BLACKLIST_ENABLED!: boolean;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  AUTH_PASSWORD_MIN_LENGTH!: number;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  AUTH_PASSWORD_REQUIRE_UPPERCASE!: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  AUTH_PASSWORD_REQUIRE_LOWERCASE!: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  AUTH_PASSWORD_REQUIRE_NUMBERS!: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  AUTH_PASSWORD_REQUIRE_SPECIAL_CHARS!: boolean;
}

export default registerAs<AuthConfig>('auth', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    jwt: {
      accessToken: {
        secret: validatedConfig.AUTH_JWT_ACCESS_SECRET,
        expiresIn: validatedConfig.AUTH_JWT_ACCESS_EXPIRES_IN ?? '15m',
      },
      refreshToken: {
        secret: validatedConfig.AUTH_JWT_REFRESH_SECRET,
        expiresIn: validatedConfig.AUTH_JWT_REFRESH_EXPIRES_IN ?? '7d',
      },
    },
    session: {
      maxActive: validatedConfig.AUTH_SESSION_MAX_ACTIVE ?? 5,
      blacklistEnabled: validatedConfig.AUTH_SESSION_BLACKLIST_ENABLED !== false,
    },
    password: {
      minLength: validatedConfig.AUTH_PASSWORD_MIN_LENGTH ?? 8,
      requireUppercase: validatedConfig.AUTH_PASSWORD_REQUIRE_UPPERCASE !== false,
      requireLowercase: validatedConfig.AUTH_PASSWORD_REQUIRE_LOWERCASE !== false,
      requireNumbers: validatedConfig.AUTH_PASSWORD_REQUIRE_NUMBERS !== false,
      requireSpecialChars: validatedConfig.AUTH_PASSWORD_REQUIRE_SPECIAL_CHARS !== false,
    },
  };
});
