import { registerAs } from '@nestjs/config';
import { IsEnum, IsOptional, IsInt, Min, Max, IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { AppConfig, Environment } from './app-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';
import { toOptionalInt } from '@/common/utils/config/env-transform.util';

class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV!: Environment;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  APP_PORT!: number;

  @IsString()
  @IsNotEmpty()
  APP_NAME!: string;

  @IsString()
  @IsOptional()
  API_PREFIX!: string;

  @IsString()
  @IsOptional()
  API_VERSION!: string;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @IsOptional()
  SHUTDOWN_TIMEOUT_MS!: number;

  @IsString()
  @IsOptional()
  FALLBACK_LANGUAGE!: string;
}

export default registerAs<AppConfig>('app', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  const nodeEnv = validatedConfig.NODE_ENV ?? Environment.DEVELOPMENT;
  const port = validatedConfig.APP_PORT ?? 3000;
  const name = validatedConfig.APP_NAME ?? 'NestJS SaaS';
  const apiPrefix = validatedConfig.API_PREFIX ?? 'api/v1';
  const apiVersion = validatedConfig.API_VERSION ?? '1';
  const shutdownTimeout = validatedConfig.SHUTDOWN_TIMEOUT_MS ?? 30000;
  const fallbackLanguage = validatedConfig.FALLBACK_LANGUAGE ?? 'en';

  return {
    nodeEnv,
    port,
    name,
    apiPrefix,
    apiVersion,
    shutdownTimeout,
    fallbackLanguage,
    corsOrigin: '*', // Will be overridden by security config
  };
});
