import { ConfigService } from '@nestjs/config';
import { I18nOptionsWithoutResolvers } from 'nestjs-i18n';
import path from 'path';

function useI18nFactory(configService: ConfigService): I18nOptionsWithoutResolvers {
  const env = configService.get<string>('app.nodeEnv') ?? 'development';
  const isLocal = env === 'local';
  const isDevelopment = env === 'development';
  return {
    fallbackLanguage: configService.get<string>('app.fallbackLanguage') ?? 'en',
    loaderOptions: {
      path: path.join(__dirname, './translations/'),
      watch: isLocal,
    },
    typesOutputPath: path.join(__dirname, '../../src/generated/i18n.generated.ts'),
    logging: isLocal || isDevelopment,
  };
}

export default useI18nFactory;
