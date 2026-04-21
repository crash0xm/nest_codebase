import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationListener } from './infrastructure/notification.listener';
import { EmailProcessor } from './infrastructure/email.processor';
import { NotificationEmailService } from './application/services/email.service';
import { MetricsModule } from '@modules/metrics/metrics.module';
import { NOTIFICATION_QUEUE_NAME } from './notification.constants';

const MockTemplateServiceProvider = {
  provide: 'TEMPLATE_SERVICE',
  useValue: {
    render: async (template: string, context: Record<string, unknown>) => {
      return `rendered ${template} with keys: ${Object.keys(context).join(', ')}`;
    },
  },
};

@Module({
  imports: [
    MetricsModule,
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE_NAME,
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
