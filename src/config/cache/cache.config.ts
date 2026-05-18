import { registerAs } from '@nestjs/config';
import { IsOptional, IsInt, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CacheConfig } from './cache-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';
import { toOptionalInt } from '@/common/utils/config/env-transform.util';

class EnvironmentVariablesValidator {
  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  CACHE_DEFAULT_TTL_MS!: number;

  @IsString()
  @IsOptional()
  CACHE_KEY_PREFIX!: string;
}

export default registerAs<CacheConfig>('cache', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    defaultTtl: validatedConfig.CACHE_DEFAULT_TTL_MS ?? 60000,
    keyPrefix: validatedConfig.CACHE_KEY_PREFIX ?? 'cache:',
  };
});
