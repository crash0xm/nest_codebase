import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { AwsS3Provider } from './providers/aws-s3.provider';
import type { StorageProvider } from './storage.interface';

export const STORAGE_PROVIDER = 'StorageProvider';

@Module({})
export class StorageModule {
  static forRoot(): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_PROVIDER,
          inject: [ConfigService],
          useFactory: (config: ConfigService): StorageProvider => {
            const provider = config.get<string>('storage.provider');

            if (!provider) {
              throw new Error('[StorageModule] STORAGE_PROVIDER not configured.');
            }

            // Never allow local storage in production
            if (provider === 'local' && config.get('app.nodeEnv') === 'production') {
              throw new Error(
                '[StorageModule] Local storage interdit en production. ' +
                  'Utilisez aws-s3, cloudinary, ou google-cloud.',
              );
            }

            switch (provider) {
              case 'aws-s3':
                return new AwsS3Provider(config);
              default:
                throw new Error(`[StorageModule] Provider not supported: ${provider}`);
            }
          },
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
