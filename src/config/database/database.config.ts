import { registerAs } from '@nestjs/config';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DatabaseConfig } from './database-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  @IsOptional()
  DATABASE_SSL!: boolean;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return parseInt(value, 10);
  })
  @IsInt()
  @IsOptional()
  DATABASE_CONNECTION_TIMEOUT!: number;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return parseInt(value, 10);
  })
  @IsInt()
  @IsOptional()
  DATABASE_IDLE_TIMEOUT!: number;
}

export default registerAs<DatabaseConfig>('database', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    url: validatedConfig.DATABASE_URL ?? '',
    ssl: validatedConfig.DATABASE_SSL,
    connectionTimeout: validatedConfig.DATABASE_CONNECTION_TIMEOUT,
    idleTimeout: validatedConfig.DATABASE_IDLE_TIMEOUT,
  };
});
