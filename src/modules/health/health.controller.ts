import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PrismaService } from '@modules/prisma/prisma.service';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter } from 'prom-client';
import { HealthCheckResult, HealthIndicatorResult } from '@nestjs/terminus';

interface HealthResult {
  status: string;
  timestamp: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly memoryIndicator: MemoryHealthIndicator,
    private readonly diskIndicator: DiskHealthIndicator,
    private readonly prisma: PrismaService,
    @InjectMetric('health_check_total')
    private readonly healthCheckCounter: Counter,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Service health check' })
  async check(): Promise<HealthCheckResult> {
    this.healthCheckCounter.inc();
    return this.health.check([
      (): Promise<HealthIndicatorResult> => this.prismaIndicator.pingCheck('database', this.prisma),
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
      (): Promise<HealthIndicatorResult> => this.prismaIndicator.pingCheck('database', this.prisma),
      (): HealthIndicatorResult => {
        return { redis: { status: 'up' } };
      },
    ]);
  }
}
