import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { RedisConfig } from './redis-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  cacheRedisHost: string = 'localhost';

  @IsInt()
  @IsOptional()
  cacheRedisPort: number = 6379;

  @IsString()
  @IsOptional()
  cacheRedisPassword: string = '';

  @IsInt()
  @IsOptional()
  cacheRedisDb: number = 0;

  @IsInt()
  @IsOptional()
  cacheRedisConnectTimeout: number = 5000;

  @IsBoolean()
  @IsOptional()
  cacheRedisLazyConnect: boolean = false;

  @IsInt()
  @IsOptional()
  cacheRedisMaxRetries: number = 3;
}

export default registerAs<RedisConfig>('redis', () => {
  const validatedConfig = validateConfig(
    process.env,
    EnvironmentVariablesValidator,
  );

  return {
    host: validatedConfig.cacheRedisHost ?? 'localhost',
    port: validatedConfig.cacheRedisPort ?? 6379,
    password: validatedConfig.cacheRedisPassword ?? '',
    db: validatedConfig.cacheRedisDb ?? 0,
    connectTimeout: validatedConfig.cacheRedisConnectTimeout ?? 5000,
    lazyConnect: validatedConfig.cacheRedisLazyConnect ?? false,
    maxRetriesPerRequest: validatedConfig.cacheRedisMaxRetries ?? 3,
  };
});
