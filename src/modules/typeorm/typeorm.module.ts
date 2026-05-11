import { Global, Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TypeOrmService } from './typeorm.service';

@Global()
@Module({
  imports: [
    NestTypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        ({
          type: config.get<string>('database.type', 'postgres'),
          url: config.get<string>('database.url'),
          autoLoadEntities: true,
          synchronize: config.get<string>('NODE_ENV') === 'development',
          logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
          ssl: config.get<boolean>('database.ssl') ?? false,
          extra: {
            connectionTimeoutMillis: config.get<number>('database.connectionTimeout') ?? 5000,
            idleTimeoutMillis: config.get<number>('database.idleTimeout') ?? 600000,
          },
        }) as unknown as TypeOrmModuleOptions,
    }),
  ],
  providers: [TypeOrmService],
  exports: [TypeOrmService, NestTypeOrmModule],
})
export class TypeOrmModule {}
