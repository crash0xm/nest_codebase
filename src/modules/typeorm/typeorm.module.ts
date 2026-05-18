import { Global, Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TypeOrmService } from './typeorm.service';

@Global()
@Module({
  imports: [
    NestTypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('app.nodeEnv');

        return {
          type: 'postgres',
          url: config.get<string>('database.url'),
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: nodeEnv === 'production',
          migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
          logging: nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
          ssl: false,
          extra: {
            connectionTimeoutMillis: config.get<number>('database.acquireTimeout') ?? 5000,
            idleTimeoutMillis: config.get<number>('database.idleTimeout') ?? 600000,
          },
        } as TypeOrmModuleOptions;
      },
    }),
  ],
  providers: [TypeOrmService],
  exports: [TypeOrmService, NestTypeOrmModule],
})
export class TypeOrmModule {}
