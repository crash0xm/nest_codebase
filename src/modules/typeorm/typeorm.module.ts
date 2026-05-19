import { Global, Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TypeOrmService } from './typeorm.service';
import { join } from 'path';

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
          migrationsRun: true,
          migrations: [join(__dirname, 'migrations', '**', '*{.ts,.js}')],
          logging: nodeEnv === 'development' ? ['error', 'warn', 'query'] : ['error'],
          ssl: config.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
          extra: {
            connectionTimeoutMillis: config.get<number>('database.acquireTimeout') ?? 5000,
            idleTimeoutMillis: config.get<number>('database.idleTimeout') ?? 600000,
            max: config.get<number>('database.poolMax') ?? 10,
            min: config.get<number>('database.poolMin') ?? 2,
          },
        };
      },
    }),
  ],
  providers: [TypeOrmService],
  exports: [TypeOrmService, NestTypeOrmModule],
})
export class TypeOrmModule {}
