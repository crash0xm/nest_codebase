import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, Min } from 'class-validator';
import { WorkerConfig } from './worker-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';
import { toOptionalInt } from '@/common/utils/config/env-transform.util';
import { Transform } from 'class-transformer';

class EnvironmentVariablesValidator {
  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @Min(1)
  @IsOptional()
  QUEUE_CONCURRENCY!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @Min(0)
  @IsOptional()
  QUEUE_MAX_STALLED_COUNT!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @Min(1000)
  @IsOptional()
  QUEUE_STALLED_INTERVAL_MS!: number;

  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @IsInt()
  @Min(1000)
  @IsOptional()
  QUEUE_LOCK_DURATION_MS!: number;
}

export default registerAs<WorkerConfig>('worker', () => {
  const env = validateConfig(process.env, EnvironmentVariablesValidator, {
    skipMissingProperties: true,
  });

  return {
    concurrency: env.QUEUE_CONCURRENCY ?? 10,
    maxStalledCount: env.QUEUE_MAX_STALLED_COUNT ?? 1,
    stalledInterval: env.QUEUE_STALLED_INTERVAL_MS ?? 30_000,
    lockDuration: env.QUEUE_LOCK_DURATION_MS ?? 30_000,
  };
});
