import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsInt, IsBoolean, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { DatabaseConfig } from './database-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';
import { toOptionalInt } from '@/common/utils/config/env-transform.util';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  DATABASE_SSL!: boolean;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  DB_ACQUIRE_TIMEOUT_MS!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  DB_IDLE_TIMEOUT_MS!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  DB_POOL_MIN!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  DB_POOL_MAX!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  DB_RETRY_MAX!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  DB_RETRY_DELAY_MS!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  DB_RETRY_BACKOFF!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  DB_SLOW_QUERY_MS!: number;
}

export default registerAs<DatabaseConfig>('database', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    url: validatedConfig.DATABASE_URL ?? '',
    ssl: validatedConfig.DATABASE_SSL,
    acquireTimeout: validatedConfig.DB_ACQUIRE_TIMEOUT_MS,
    idleTimeout: validatedConfig.DB_IDLE_TIMEOUT_MS,
    poolMin: validatedConfig.DB_POOL_MIN,
    poolMax: validatedConfig.DB_POOL_MAX,
    retryMax: validatedConfig.DB_RETRY_MAX,
    retryDelay: validatedConfig.DB_RETRY_DELAY_MS,
    retryBackoff: validatedConfig.DB_RETRY_BACKOFF,
    slowQuery: validatedConfig.DB_SLOW_QUERY_MS,
  };
});
