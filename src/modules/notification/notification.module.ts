import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationListener } from './infrastructure/notification.listener';
import { EmailProcessor } from './infrastructure/email.processor';
import { NotificationEmailService } from './application/services/email.service';
import { MetricsModule } from '@modules/metrics/metrics.module';
import { NOTIFICATION_QUEUE_NAME } from './notification.constants';
import type { WorkerConfig } from '@config/worker/worker-config.type';

const MockTemplateServiceProvider = {
  provide: 'TEMPLATE_SERVICE',
  useValue: {
    render: (template: string, context: Record<string, unknown>): Promise<string> => {
      return Promise.resolve(
        `[mock] rendered "${template}" with keys: ${Object.keys(context).join(', ')}`,
      );
    },
  },
};

@Module({
  imports: [
    MetricsModule,

    BullModule.registerQueueAsync({
      name: NOTIFICATION_QUEUE_NAME,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const workerCfg = config.get<WorkerConfig>('worker');
        return {
          name: NOTIFICATION_QUEUE_NAME,
          workerOptions: {
            concurrency: workerCfg?.concurrency ?? 10,
            lockDuration: workerCfg?.lockDuration ?? 30_000,
            stalledInterval: workerCfg?.stalledInterval ?? 30_000,
            maxStalledCount: workerCfg?.maxStalledCount ?? 1,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
          },
        };
      },
    }),
  ],
  providers: [
    NotificationListener,
    EmailProcessor,
    NotificationEmailService,
    MockTemplateServiceProvider,
  ],
  exports: [NotificationEmailService],
})
export class NotificationModule {}
