import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { RedisConfig } from './redis-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';
import { toOptionalInt } from '@/common/utils/config/env-transform.util';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  REDIS_HOST!: string;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  REDIS_PORT!: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD!: string;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  REDIS_DB!: number;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  REDIS_TLS!: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  REDIS_CLUSTER!: boolean;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  REDIS_CONNECT_TIMEOUT!: number;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  REDIS_LAZY_CONNECT!: boolean;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  REDIS_MAX_RETRIES!: number;
}

export default registerAs<RedisConfig>('redis', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    host: validatedConfig.REDIS_HOST ?? 'localhost',
    port: validatedConfig.REDIS_PORT ?? 6379,
    password: validatedConfig.REDIS_PASSWORD ?? '',
    db: validatedConfig.REDIS_DB,
    tls: validatedConfig.REDIS_TLS,
    cluster: validatedConfig.REDIS_CLUSTER,
    connectTimeout: validatedConfig.REDIS_CONNECT_TIMEOUT,
    lazyConnect: validatedConfig.REDIS_LAZY_CONNECT,
    maxRetriesPerRequest: validatedConfig.REDIS_MAX_RETRIES,
  };
});
