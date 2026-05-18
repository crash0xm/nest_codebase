import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsInt, IsBoolean, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { AuthConfig } from './auth-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';
import { toOptionalInt } from '@/common/utils/config/env-transform.util';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_PASSWORD_RESET_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_PASSWORD_RESET_EXPIRES_IN!: string;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  MAX_ACTIVE_SESSIONS!: number;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  SESSION_BLACKLIST_ENABLED!: boolean;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  PASSWORD_MIN_LENGTH!: number;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  PASSWORD_REQUIRE_UPPERCASE!: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  PASSWORD_REQUIRE_LOWERCASE!: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  PASSWORD_REQUIRE_NUMBERS!: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  PASSWORD_REQUIRE_SPECIAL_CHARS!: boolean;
}

export default registerAs<AuthConfig>('auth', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    jwt: {
      accessToken: {
        secret: validatedConfig.JWT_ACCESS_SECRET,
        expiresIn: validatedConfig.JWT_ACCESS_EXPIRES_IN ?? '15m',
      },
      refreshToken: {
        secret: validatedConfig.JWT_REFRESH_SECRET,
        expiresIn: validatedConfig.JWT_REFRESH_EXPIRES_IN ?? '7d',
      },
      passwordReset: {
        secret: validatedConfig.JWT_PASSWORD_RESET_SECRET,
        expiresIn: validatedConfig.JWT_PASSWORD_RESET_EXPIRES_IN ?? '1h',
      },
    },
    session: {
      maxActive: validatedConfig.MAX_ACTIVE_SESSIONS ?? 5,
      blacklistEnabled: validatedConfig.SESSION_BLACKLIST_ENABLED !== false,
    },
    password: {
      minLength: validatedConfig.PASSWORD_MIN_LENGTH ?? 8,
      requireUppercase: validatedConfig.PASSWORD_REQUIRE_UPPERCASE !== false,
      requireLowercase: validatedConfig.PASSWORD_REQUIRE_LOWERCASE !== false,
      requireNumbers: validatedConfig.PASSWORD_REQUIRE_NUMBERS !== false,
      requireSpecialChars: validatedConfig.PASSWORD_REQUIRE_SPECIAL_CHARS !== false,
    },
  };
});
