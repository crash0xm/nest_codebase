import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthIndicatorResult,
  HealthCheckResult,
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter } from 'prom-client';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@modules/redis/redis.module';

interface HealthResult {
  status: string;
  timestamp: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memoryIndicator: MemoryHealthIndicator,
    private readonly diskIndicator: DiskHealthIndicator,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectMetric('health_check_total')
    private readonly healthCheckCounter: Counter,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Service health check' })
  async check(): Promise<HealthCheckResult> {
    this.healthCheckCounter.inc();
    return this.health.check([
      (): Promise<HealthIndicatorResult> => this.pingDatabase(),
      (): Promise<HealthIndicatorResult> =>
        this.memoryIndicator.checkHeap('memory_heap', 300 * 1024 * 1024),
      (): Promise<HealthIndicatorResult> =>
        this.diskIndicator.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness(): HealthResult {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Kubernetes readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      (): Promise<HealthIndicatorResult> => this.pingDatabase(),
      (): Promise<HealthIndicatorResult> => this.pingRedis(),
    ]);
  }

  private async pingDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.dataSource.query('SELECT 1');
      return { database: { status: 'up' } };
    } catch (error) {
      return {
        database: {
          status: 'down',
          message: (error as Error).message,
        },
      };
    }
  }

  private async pingRedis(): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return { redis: { status: 'up' } };
    } catch (error) {
      return {
        redis: {
          status: 'down',
          message: (error as Error).message,
        },
      };
    }
  }
}
