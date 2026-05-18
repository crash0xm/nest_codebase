import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EMAIL_CONFIG_KEY, EMAIL_PROVIDER_TOKEN } from './email.interface';
import type { EmailProvider, EmailConfig } from './email.interface';
import { SendgridProvider } from './providers/sendgrid.provider';
import { SesProvider } from './providers/ses.provider';

@Module({})
export class EmailModule {
  static forRoot(): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        {
          provide: EMAIL_CONFIG_KEY,
          inject: [ConfigService],
          useFactory: (configService: ConfigService) =>
            configService.getOrThrow<EmailConfig>(EMAIL_CONFIG_KEY),
        },
        {
          provide: EMAIL_PROVIDER_TOKEN,
          inject: [ConfigService],
          useFactory: (configService: ConfigService): EmailProvider => {
            const emailConfig = configService.getOrThrow<EmailConfig>(EMAIL_CONFIG_KEY);
            switch (emailConfig.provider) {
              case 'sendgrid':
                return new SendgridProvider(configService);
              case 'ses':
                return new SesProvider(configService);
              default:
                throw new Error(
                  `[EmailModule] Unsupported email provider: "${emailConfig.provider}". ` +
                    `Supported: sendgrid, ses`,
                );
            }
          },
        },
        EmailService,
      ],
      exports: [EmailService],
    };
  }

  static forRootAsync(options: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => Promise<EmailConfig> | EmailConfig;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inject?: any[];
  }): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        {
          provide: EMAIL_CONFIG_KEY,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        {
          provide: EMAIL_PROVIDER_TOKEN,
          inject: [ConfigService],
          useFactory: (configService: ConfigService): EmailProvider => {
            const emailConfig = configService.getOrThrow<EmailConfig>(EMAIL_CONFIG_KEY);
            switch (emailConfig.provider) {
              case 'sendgrid':
                return new SendgridProvider(configService);
              case 'ses':
                return new SesProvider(configService);
              default:
                throw new Error(`[EmailModule] Unsupported provider: "${emailConfig.provider}"`);
            }
          },
        },
        EmailService,
      ],
      exports: [EmailService],
    };
  }
}
