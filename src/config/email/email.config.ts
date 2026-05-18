import { registerAs } from '@nestjs/config';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { EmailConfig } from './email-config.type';
import { validateConfig } from '@/common/utils/config/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsIn(['sendgrid', 'ses', 'mailgun'])
  EMAIL_PROVIDER!: string;

  @IsString()
  @IsOptional()
  SENDGRID_API_KEY!: string;

  @IsString()
  @IsOptional()
  SENDGRID_FROM_EMAIL!: string;

  @IsString()
  @IsOptional()
  SENDGRID_FROM_NAME!: string;

  @IsString()
  @IsOptional()
  SES_REGION!: string;

  @IsString()
  @IsOptional()
  SES_ACCESS_KEY_ID!: string;

  @IsString()
  @IsOptional()
  SES_SECRET_ACCESS_KEY!: string;

  @IsString()
  @IsOptional()
  SES_FROM_EMAIL!: string;

  @IsString()
  @IsOptional()
  SES_FROM_NAME!: string;
}

export default registerAs<EmailConfig>('email', () => {
  const env = validateConfig(process.env, EnvironmentVariablesValidator, {
    skipMissingProperties: true,
  });

  const provider = (env.EMAIL_PROVIDER ?? 'sendgrid') as EmailConfig['provider'];

  return {
    provider,
    sendgrid:
      provider === 'sendgrid'
        ? {
            apiKey: env.SENDGRID_API_KEY ?? '',
            fromEmail: env.SENDGRID_FROM_EMAIL ?? '',
            fromName: env.SENDGRID_FROM_NAME ?? '',
          }
        : undefined,
    ses:
      provider === 'ses'
        ? {
            region: env.SES_REGION ?? 'us-east-1',
            accessKeyId: env.SES_ACCESS_KEY_ID ?? '',
            secretAccessKey: env.SES_SECRET_ACCESS_KEY ?? '',
            fromEmail: env.SES_FROM_EMAIL ?? '',
            fromName: env.SES_FROM_NAME ?? '',
          }
        : undefined,
  };
});
