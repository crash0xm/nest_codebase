import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';

describe('AppConfig', () => {
  beforeEach(() => {
    // Clean up environment variables before each test
    delete process.env.APP_PORT;
    delete process.env.APP_NAME;
    delete process.env.NODE_ENV;
    delete process.env.API_VERSION;
    delete process.env.SHUTDOWN_TIMEOUT_MS;
  });

  it('should load default config values', async () => {
    // Set valid environment variables for test
    process.env.APP_PORT = '3000';
    process.env.APP_NAME = 'NestJS SaaS';
    process.env.NODE_ENV = 'development';
    process.env.API_VERSION = '1';
    process.env.SHUTDOWN_TIMEOUT_MS = '30000';

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig],
          isGlobal: true,
        }),
      ],
    }).compile();

    // Test the config function directly
    const config = (await appConfig()) as any;

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.name).toBe('NestJS SaaS');
    expect(config.apiPrefix).toBe('api/v1');
    expect(config.apiVersion).toBe('1');
    expect(config.shutdownTimeout).toBe(30000);
    expect(config.fallbackLanguage).toBe('en');
  });

  it('should load custom config values from environment', async () => {
    process.env.APP_PORT = '4000';
    process.env.APP_NAME = 'Custom App';
    process.env.NODE_ENV = 'production';

    const config = (await appConfig()) as any;

    expect(config.port).toBe(4000);
    expect(config.name).toBe('Custom App');
    expect(config.nodeEnv).toBe('production');

    // Cleanup
    delete process.env.APP_PORT;
    delete process.env.APP_NAME;
    delete process.env.NODE_ENV;
  });
});
