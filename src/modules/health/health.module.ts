import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsModule } from '@modules/metrics/metrics.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, MetricsModule],
  controllers: [HealthController],
  providers: [],
})
export class HealthModule {}
