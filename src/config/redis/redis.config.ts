import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { RedisConfig } from './redis-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  CACHE_REDIS_HOST!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return parseInt(String(value), 10);
  })
  @IsInt()
  @IsOptional()
  CACHE_REDIS_PORT!: number;

  @IsString()
  @IsOptional()
  CACHE_REDIS_PASSWORD!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return parseInt(String(value), 10);
  })
  @IsInt()
  @IsOptional()
  CACHE_REDIS_DB!: number;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return parseInt(String(value), 10);
  })
  @IsInt()
  @IsOptional()
  CACHE_REDIS_CONNECT_TIMEOUT!: number;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  CACHE_REDIS_LAZY_CONNECT!: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return parseInt(String(value), 10);
  })
  @IsInt()
  @IsOptional()
  CACHE_REDIS_MAX_RETRIES!: number;
}

export default registerAs<RedisConfig>('redis', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    host: validatedConfig.CACHE_REDIS_HOST ?? 'localhost',
    port: validatedConfig.CACHE_REDIS_PORT ?? 6379,
    password: validatedConfig.CACHE_REDIS_PASSWORD ?? '',
    db: validatedConfig.CACHE_REDIS_DB,
    connectTimeout: validatedConfig.CACHE_REDIS_CONNECT_TIMEOUT,
    lazyConnect: validatedConfig.CACHE_REDIS_LAZY_CONNECT,
    maxRetriesPerRequest: validatedConfig.CACHE_REDIS_MAX_RETRIES,
  };
});
