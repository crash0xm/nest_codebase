import { registerAs } from '@nestjs/config';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { StorageConfig } from './storage-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsIn(['aws-s3', 'cloudinary', 'google-cloud'])
  STORAGE_PROVIDER!: string;

  @IsString()
  @IsOptional()
  AWS_S3_REGION!: string;

  @IsString()
  @IsOptional()
  AWS_S3_BUCKET!: string;

  @IsString()
  @IsOptional()
  AWS_S3_ACCESS_KEY_ID!: string;

  @IsString()
  @IsOptional()
  AWS_S3_SECRET_ACCESS_KEY!: string;

  @IsString()
  @IsOptional()
  AWS_S3_ENDPOINT!: string;
}

export default registerAs<StorageConfig>('storage', () => {
  const env = validateConfig(process.env, EnvironmentVariablesValidator, {
    skipMissingProperties: true,
  });

  const provider = (env.STORAGE_PROVIDER ?? 'aws-s3') as StorageConfig['provider'];

  return {
    provider,
    awsS3:
      provider === 'aws-s3'
        ? {
            region: env.AWS_S3_REGION ?? 'us-east-1',
            bucket: env.AWS_S3_BUCKET ?? '',
            accessKeyId: env.AWS_S3_ACCESS_KEY_ID ?? '',
            secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY ?? '',
            endpoint: env.AWS_S3_ENDPOINT,
            forcePathStyle: false,
          }
        : undefined,
  };
});
